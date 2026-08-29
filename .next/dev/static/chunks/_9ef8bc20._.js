(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/html2canvas/dist/html2canvas.js [app-client] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.resolve().then(() => {
        return parentImport("[project]/node_modules/html2canvas/dist/html2canvas.js [app-client] (ecmascript)");
    });
});
}),
"[project]/node_modules/dompurify/dist/purify.es.mjs [app-client] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "static/chunks/node_modules_dompurify_dist_purify_es_mjs_61e0c95e._.js",
  "static/chunks/node_modules_dompurify_dist_purify_es_mjs_c469a138._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/node_modules/dompurify/dist/purify.es.mjs [app-client] (ecmascript)");
    });
});
}),
"[project]/node_modules/canvg/lib/index.es.js [app-client] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "static/chunks/node_modules_59d1188d._.js",
  "static/chunks/node_modules_canvg_lib_index_es_c469a138.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/node_modules/canvg/lib/index.es.js [app-client] (ecmascript)");
    });
});
}),
"[project]/src/features/family-tree/components/MapPanel.tsx [app-client] (ecmascript, next/dynamic entry, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "static/chunks/node_modules_11cd6a26._.js",
  "static/chunks/src_features_family-tree_components_MapPanel_tsx_0b6671fd._.js",
  {
    "path": "static/chunks/node_modules_leaflet_dist_leaflet_ef5f0413.css",
    "included": [
      "[project]/node_modules/leaflet/dist/leaflet.css [app-client] (css)"
    ]
  },
  "static/chunks/src_features_family-tree_components_MapPanel_tsx_d4eefaa4._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/src/features/family-tree/components/MapPanel.tsx [app-client] (ecmascript, next/dynamic entry)");
    });
});
}),
]);