import { describe, it } from "node:test";
import assert from "node:assert";

import { routes } from "./routes";

let settingsRoutes = routes({
	project: "project",
	withParams: (p: { fuu: number }) => `param/${p.fuu}`,
});

let authRoutes = routes({
	users: "users",
	methods: "methods",
	settings: {
		path: "settings",
		routes: settingsRoutes,
	},
});

let fileRoutes = routes({
	file: (p: { fileId: string }) => `file/${p.fileId}`
})

let storageRoutes = routes({
	buckets: {
		path: () => "buckets",
		routes: fileRoutes,
	},
});

let appRoutes = routes({
	auth: {
		path: "authentication",
		routes: authRoutes,
	},
	storage: {
		path: (p: { id: string }) => `storage/${p.id}`,
		routes: storageRoutes,
	},
});

describe("routes", () => {
	it("works for plain routes", () => {
		assert.equal(settingsRoutes.project.path, "project");
		assert.equal(settingsRoutes.project, "project");
		assert.equal(settingsRoutes.withParams({ fuu: 1 }), "param/1");
		assert.equal(settingsRoutes.withParams.path, "param/:fuu");
	});

	it("works for nested routes", () => {
		assert.equal(authRoutes.settings.project.path, "settings/project");
		assert.equal(authRoutes.settings.project, "settings/project");

		assert.equal(
			appRoutes.auth.settings.withParams({ fuu: 1 }),
			"authentication/settings/param/1",
		);
		assert.equal(
			appRoutes.auth.settings.withParams.path,
			"authentication/settings/param/:fuu",
		);
		assert.equal(appRoutes.auth.path, "authentication");

		assert.equal(appRoutes.storage.path, "storage/:id");
		assert.equal(appRoutes.storage({ id: "some-id" }), "storage/some-id");
		assert.equal(
			appRoutes.storage({ id: "some-id" }).buckets(),
			"storage/some-id/buckets",
		);

		assert.equal(
			appRoutes.storage.buckets.path,
			"storage/:id/buckets"
		)

		assert.equal(
			appRoutes.storage({ id: "fuu" }).buckets().file({ fileId: "12345" }),
			"storage/fuu/buckets/file/12345"
		)

		assert.equal(
			appRoutes.storage.buckets.file.path,
			"storage/:id/buckets/file/:fileId"
		)
	});
});
