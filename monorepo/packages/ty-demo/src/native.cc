#include <napi.h>

#include "native.h"

extern "C"
{
    void generate_welcome_message(const char *name, char *out_sentence, size_t max_len);
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(
        Napi::String::New(env, "getWholeSentence"), Napi::Function::New(env, GetWholeSentenceMethod));

    return exports;
}

Napi::String GetWholeSentenceMethod(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    std::string name = "chenty-init";
    if (info.Length() > 0 && info[0].IsString())
    {
        name = info[0].As<Napi::String>().Utf8Value();
    }

    char wholeSentence[200];
    generate_welcome_message(name.c_str(), wholeSentence, sizeof(wholeSentence));

    return Napi::String::New(env, wholeSentence);
}

NODE_API_MODULE(ty_demo, Init)
