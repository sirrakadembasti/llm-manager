export default function legacyDotnet() {
  return {
    'LlmClient.cs': `using System;
using System.IO;
using System.Net;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace LlmManager
{
    public static class LlmClient
    {
        [DataContract] private class RequestDto {
            [DataMember] public string prompt;
            [DataMember] public string system;
        }
        [DataContract] private class ResponseDto {
            [DataMember] public string text;
            [DataMember] public string content;
            [DataMember] public string error;
            [DataMember] public string code;
        }
        // .NET 4.0: TPL supplies the public Task API without async builders or NuGet.
        public static Task<string> AskAsync(string prompt, string system = "", CancellationToken cancellationToken = default(CancellationToken))
        {
            return Task.Factory.StartNew(delegate {
                cancellationToken.ThrowIfCancellationRequested();
                var url = Environment.GetEnvironmentVariable("LLM_MANAGER_URL") ?? "http://127.0.0.1:8010/api/llm/chat";
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json; charset=utf-8";
                req.Headers[HttpRequestHeader.Authorization] = "Bearer " + Environment.GetEnvironmentVariable("LLM_CHAT_TOKEN");
                req.Headers["X-LLM-CSRF"] = "1";
                req.Timeout = req.ReadWriteTimeout = 330000;
                int timedOut = 0;
                // Abort interrupts request upload, response headers and response-body reads.
                using (cancellationToken.Register(req.Abort))
                using (var timer = new Timer(delegate { Interlocked.Exchange(ref timedOut, 1); req.Abort(); }, null, 330000, Timeout.Infinite))
                {
                    try {
                        using (var payload = new MemoryStream()) {
                            new DataContractJsonSerializer(typeof(RequestDto)).WriteObject(payload, new RequestDto { prompt = prompt, system = system });
                            var bytes = payload.ToArray();
                            req.ContentLength = bytes.Length;
                            using (var stream = req.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
                        }
                        HttpWebResponse response;
                        try { response = (HttpWebResponse)req.GetResponse(); }
                        catch (WebException error) {
                            response = error.Response as HttpWebResponse;
                            if (response == null) throw;
                        }
                        using (response)
                        using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8)) {
                            var body = reader.ReadToEnd();
                            cancellationToken.ThrowIfCancellationRequested();
                            if (Interlocked.CompareExchange(ref timedOut, 0, 0) != 0) throw new TimeoutException();
                            var status = (int)response.StatusCode;
                            ResponseDto data;
                            try {
                                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(body)))
                                    data = (ResponseDto)new DataContractJsonSerializer(typeof(ResponseDto)).ReadObject(stream);
                            } catch (Exception error) { throw new InvalidOperationException("LLM sunucusu geçersiz JSON döndürdü (HTTP " + status + ")", error); }
                            if (data == null) throw new InvalidOperationException("LLM sunucusu boş JSON yanıtı döndürdü (HTTP " + status + ")");
                            if (status < 200 || status >= 300) throw new InvalidOperationException(data.error ?? data.code ?? "LLM isteği başarısız (HTTP " + status + ")");
                            return data.content ?? data.text ?? "";
                        }
                    } catch (Exception error) {
                        cancellationToken.ThrowIfCancellationRequested();
                        if (Interlocked.CompareExchange(ref timedOut, 0, 0) != 0 || (error is WebException && ((WebException)error).Status == WebExceptionStatus.Timeout))
                            throw new InvalidOperationException("LLM isteği zaman aşımına uğradı (330 saniye)", error);
                        if (error is InvalidOperationException) throw;
                        throw new InvalidOperationException("LLM isteği başarısız", error);
                    }
                }
            }, cancellationToken, TaskCreationOptions.None, TaskScheduler.Default);
        }
    }
}
`
  };
}
