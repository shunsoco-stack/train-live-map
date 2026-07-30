# M PLUS Rounded 1c subset

`m-plus-rounded-brand-routes-700.woff2` is a 700-weight subset of
M PLUS Rounded 1c, distributed under the SIL Open Font License in
`OFL.txt`.

The subset contains the `Train Live Map` brand text and the route names
declared in `src/data/railwayCatalog.ts`. Other Japanese text uses the
system-font fallback, so dynamic station and destination names never
render as missing-glyph boxes.

It was generated from
`@fontsource/m-plus-rounded-1c/files/m-plus-rounded-1c-japanese-700-normal.woff2`
with FontTools 4.63.0 and Brotli 1.2.0:

```text
pyftsubset <source.woff2> --text=<brand-and-route-character-set>
  --flavor=woff2 --layout-features=* --no-hinting
```
