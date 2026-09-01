{
    "targets": [
    {
        "target_name": "ty_logger",
        "type": "static_library",
        "sources": [
            "src/core/tools/ty_logger.c"
        ],
        "include_dirs": [
            "src/core/tools"
        ],
        "direct_dependent_settings": {
            "include_dirs": ["src/core/tools"]
        },
        "cflags": ["-Wall", "-Wextra", "-fPIC"]
    },
    {
        "target_name": "ty_demo",
        "type": "loadable_module",
        "sources": [
            "src/native.cc",
            "src/core/main/main.c"
        ],
        "include_dirs": [
            "src/core/tools",
            "src/core/main",
            "<!@(node -p \"require('node-addon-api').include\")"
        ],
        "dependencies": [
            "ty_logger"
        ],
        "defines": [
            "NAPI_DISABLE_CPP_EXCEPTIONS"
        ],
        "cflags_cc!": ["-fno-exceptions"],
        "cflags": ["-fPIC"],
        "product_name": "ty_demo",
        "product_extension": "node"
    }]
}
