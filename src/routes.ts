type NestedRoutes<Path, Children extends object> = {
	path: Path;
	routes: Routes<Children>;
};

type ParamFn<Params = any> = (p: Params) => string;
type StringFn = () => string;
type WithPath<A> = A & { path: string };

type Routes<Paths extends object> = {
	[Key in keyof Paths]: Paths[Key] extends string
		? WithPath<Paths[Key]>
		: Paths[Key] extends StringFn
		? WithPath<() => string>
		: Paths[Key] extends ParamFn<infer Args>
		? WithPath<(params: Args) => string>
		// Nested Routes
		: Paths[Key] extends NestedRoutes<infer Path, infer Children>
			? Path extends string
			? WithPath<Routes<Children>>
			: Path extends StringFn
			? WithPath<() => string & Routes<Children>> & Routes<Children>
			: Path extends ParamFn<infer PArgs>
			? WithPath<(params: PArgs) => string & Routes<Children>> & Routes<Children>
			: never
		: never;
};

let handler: ProxyHandler<any> = {
	get: (_target, key) => {
		return `:${key.toString()}`;
	},
};

let paramsProxy = new Proxy({}, handler);

type RouteInfo = {
	value: string | ParamFn | StringFn;
	children?: Map<string, RouteInfo>;
};

function createRouteProxyHandler(
	routeInfo: Map<string, RouteInfo>,
	parentPath?: string,
) {
	let handler: ProxyHandler<any> = {
		get: (target, key) => {
			if (target[key] !== undefined) {
				return target[key];
			}

			let { value, children } = routeInfo.get(key.toString()) ?? {};

			if (value === undefined) {
				throw new Error("invalid path");
			}

			if (typeof value === "string") {
				let basePath = parentPath ? `${parentPath}/${value}` : value;

				let path = Object.assign(new String(basePath), {
					path: basePath,
					valueOf: () => basePath,
					[Symbol.toPrimitive]: () => {
						return basePath;
					},
				});

				if (!children) {
					return path;
				}

				let proxy = createRouteProxyHandler(children, basePath);
				return new Proxy(path, proxy);
			}

			if (typeof value === "function") {
				let pathHandler = Object.assign(value, {

					get path() {
						if (typeof value === "function") {
							let path = parentPath
								? `${parentPath}/${value(paramsProxy)}`
								: value(paramsProxy);
							return path;
						}

						return value;
					},
				});



				let fn = new Proxy(pathHandler, {
					get: (target: any, key) => {
						if (target[key] !== undefined) {
							return target[key]
						}

						let {
							value: route,
							children: nestedChildren
						} = children?.get(key.toString()) ?? {};

						if (!route) {
							return undefined;
						}

						let value = Object.assign(route, {
							get path() {
								if (typeof route === "string") {
									return `${target.path}/${route}`
								}

								if (typeof route === "function") {
									return `${target.path}/${route(paramsProxy)}`
								}
							}
						})

						if (!nestedChildren) {
							return value
						}

						let proxy = createRouteProxyHandler(nestedChildren, value.path);
						return new Proxy(value, proxy);

					},
					apply: (target, _thisArg, argArray) => {
						let value = target(argArray[0]);
						let basePath = parentPath ? `${parentPath}/${value}` : value;

						let path = Object.assign(new String(basePath), {
							valueOf: () => basePath,
							[Symbol.toPrimitive]: () => {
								return basePath;
							},
						});

						if (!children) {
							return path;
						}

						let proxy = createRouteProxyHandler(children, basePath);
						return new Proxy(path, proxy);
					},
				});

				return fn;
			}

			throw new Error(
				`Invalid Path "${key.toString()}", expected string or function, instead got: ${typeof value}`,
			);
		},
	};

	return handler;
}

type RoutesConfig = {
	[route: string]: string | ParamFn | StringFn | NestedRoutes<string | ParamFn, RoutesConfig>
}

export function routes<P extends RoutesConfig>(paths: P): Routes<P> {
	let RouteInfos = new Map<string, RouteInfo>();

	for (let [route, handler] of Object.entries(paths)) {
		if (typeof handler === "string" || typeof handler === "function") {
			let routeInfo: RouteInfo = {
				value: handler,
			};

			RouteInfos.set(route, routeInfo);
			continue;
		}

		if (handler.path && handler.routes) {
			RouteInfos.set(route, {
				value: handler.path,
				children: (handler.routes as any).getRoutes(),
			});

			continue;
		}
	}

	let handler = createRouteProxyHandler(RouteInfos);
	return new Proxy({ getRoutes: () => RouteInfos }, handler) as Routes<P>;
}
