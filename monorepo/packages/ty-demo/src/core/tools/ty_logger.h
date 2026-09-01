#ifndef __TY_LOGGER_H__
#define __TY_LOGGER_H__

typedef enum
{
    L_DEBUG,
    L_INFO,
    L_WARN,
    L_ERROR
} log_level_t;

void ty_log(log_level_t level, const char *file, int line, const char *format, ...);
#define LOG_INFO(fmt, ...) ty_log(L_INFO, __FILE__, __LINE__, fmt, ##__VA_ARGS__)
#define LOG_ERROR(fmt, ...) ty_log(L_ERROR, __FILE__, __LINE__, fmt, ##__VA_ARGS__)
#define LOG_DEBUG(fmt, ...) ty_log(L_DEBUG, __FILE__, __LINE__, fmt, ##__VA_ARGS__)

#endif
