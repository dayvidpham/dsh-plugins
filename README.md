# dsh-plugins

Personal DeepSeek Harness plugin bundles, one package per plugin.

Each directory under [`packages/`](packages/) is an independent npm package that the
Harness can install into a profile. A package is the install, enable, disable, and
remove unit: the profile records it as a dependency and selects its patch layer.

## Layout

```text
dsh-plugins/
├── package.json           # private workspace root; not installed into a profile
├── pnpm-workspace.yaml
└── packages/
    └── sidebar-video-preview/
        ├── package.json   # name, exports, dsh.bundle, dsh.client
        ├── cordis.patch.yml
        ├── index.js       # Host half
        ├── client.js      # optional Web UI half
        ├── locale/        # plugin inventory metadata
        ├── icon.svg
        └── README.md
```

## Install a plugin

Install the **package directory**, not the repository root, through Harness's plugin
manager (the `plugin_manager` tool, or Settings → Plugins → Add). For a local checkout
the profile links the directory, so edits reload without reinstalling.

```text
/home/minttea/codebases/dayvidpham/dsh-plugins/packages/sidebar-video-preview
```

Only one package per install: installing the repository root would install a package
with no `dsh.bundle` patch.

## Package requirements

A Host bundle needs:

- `package.json` with a unique package name, `"type": "module"`, an `exports` entry for
  the runtime module, and `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`.
- A patch that inserts at least one Loader row whose `name` is this package.
- `locale/en.json` + `locale/zh.json` (`meta.title`, `meta.description`) and an
  exported icon, so Plugin Manager has display metadata.

A Web UI plugin additionally needs:

- `"dsh": { "client": { "platform": "web", "inject": [...] } }` and an `exports` entry
  for `./client`.
- `client.js` that calls `window.__ModuleLoader__.load({ id: '<package name>', factory })`
  and returns the Cordis plugin. `id` must equal the package name exactly.

Declare every service the client half reads in the plugin's `inject` array
(`['slots', 'locale', ...]`). Cordis throws on an undeclared service read, and the
plugin's registrations never happen.

### Moving a linked package

A running Host caches a client package's resolved bundle path per package name until it
restarts. If you move a linked package, either restart the Host before reinstalling or
keep the old path reachable (for example with a symlink) until the next restart;
otherwise the browser keeps requesting the deleted path and the client half does not
load.

One package may insert several Loader rows, and a package can host subpath plugins
(`my-plugin/feature` with matching subpath locale/icon exports). Keep independently
enabled UI features as separate packages.

## Client-bundle constraints

Browser bundles resolve imports from the shell's shared module table (React is
baseline) and from exact packages declared in `dsh.client.external`. They cannot
`require` a sibling package from this repo at runtime. Share code by copying it into
each `client.js`, or add a build step that emits self-contained client bundles.

## Checking a package

There is no build step for plain-JavaScript bundles. Before installing:

```sh
node --check packages/<name>/client.js
node --check packages/<name>/index.js
node -e "JSON.parse(require('fs').readFileSync('packages/<name>/package.json'))"
```

`node` is not on this host's default `PATH`; use the Node binary from the `dsh`
launcher when running these by hand.
