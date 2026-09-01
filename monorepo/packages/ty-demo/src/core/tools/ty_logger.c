#include <stdio.h>
#include <stdarg.h>
#include <stddef.h>

#include "ty_logger.h"

void ty_log(log_level_t level, const char *file, int line, const char *format, ...)
{
    // 第一步：把业务信息格式化输出到一个临时的 msg buffer
    char msg_buf[1024] = {0};
    va_list args;
    va_start(args, format);
    vsnprintf(msg_buf, sizeof(msg_buf) - 1, format, args);
    va_end(args);

    const char *level_str = "info";
    if (level == L_DEBUG)
        level_str = "debug";
    else if (level == L_WARN)
        level_str = "warn";
    else if (level == L_ERROR)
        level_str = "error";

    // 第二步：通过标准流(IPC)将单行标准 JSON 转给 Pino。
    printf("{\"level\":\"%s\",\"file\":\"%s\",\"line\":%d,\"msg\":\"%s\"}\n",
           level_str, file, line, msg_buf);

    // 极其重要：立刻冲刷缓冲区，保证 Node.js Pino 实时消费
    fflush(stdout);
}
