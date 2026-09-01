#include <stdio.h>
#include <string.h>

#include "main.h"
#include "ty_logger.h"

void generate_welcome_message(const char *name, char *out_sentence, size_t max_len)
{
    const char prefix[] = "My name is";

    snprintf(out_sentence, max_len, "%s %s", prefix, name);
    LOG_DEBUG("out_sentence=%s", out_sentence);
    out_sentence[max_len - 1] = '\0';
}
