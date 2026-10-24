# Spacing correction

The resource Save button had a measured 0px gap before its helper paragraph. Shared `.button + p` spacing now provides 16px across affected screens. Artwork captions have 12px separation, and stacked Settings labels have 16px separation. Removed the old Settings-only 20px button/helper override.

Verification: production build passed; 72 browser layout checks (18 routes at 1440, 768, 390 and 320px) found no horizontal overflow or page errors. All eight discovery resource previews and Settings have a measured 16px button/helper gap. Artwork captions were also checked. Save-resource dialog opened and dismissed successfully. Desktop/mobile discovery and Settings screenshots were visually inspected. No application behavior, model or backend changes.

`results.json` contains the measurements. The baseline screenshot is the visual-hierarchy resource; final screenshots show the whitespace resource. They demonstrate the shared pattern, rather than a matched content comparison.
