# CV structure and Variants

`facts.yaml` accepts optional keys beside `facts:`:

- `profile`: `name` and a `contact` map.
- `experience` and `projects`: Entries with `id`, `name`, `role`, `dates` and a `metadata` map.
- `skills`: groups with `name` and `items`.

A Bullet in `bullets.yaml` may carry `entry` (an Entry id) and `order` (a number). Bullets of an Entry are grouped under it and sorted by `order`; Bullets without `entry` stay in the flat list.

Variants live under `variants:` in `bullets.yaml`:

```yaml
variants:
  startup:
    all: [en]
    none: [enterprise]
```

`all` requires every tag, `any` at least one, `none` excludes tags. `huntline cv build --variant startup` applies the rule and names the output `startup`. `--tag` stays an OR shortcut and can be combined with a Variant. A `--variant` name that is not defined fails with `unknown-variant` when the data dir defines Variants and no `--tag` or `--requirement` is given.

The Typst payload is `{variant, bullets, header, experience, projects, skills}`. `bullets` stays the flat selection; `experience` and `projects` list only Entries that have selected Bullets. `examples/cv/template.typ` renders all of it. A data dir without the new keys builds as before.
