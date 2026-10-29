import legacyDotnet from './dotnet-legacy.js';

export default function dotnet({ legacy = false, apiPath = '/api/llm' } = {}) {
  if (legacy) return legacyDotnet({ apiPath });
  // HttpClient/async require Framework 4.5+; older targets use the TPL template.
  return {
    'LlmClient.cs': `using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace LlmManager
{
    public static class LlmClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(330) };
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
        public static async Task<string> AskAsync(string prompt, string system = "", CancellationToken cancellationToken = default(CancellationToken))
        {
            var url = Environment.GetEnvironmentVariable("LLM_MANAGER_URL") ?? ${JSON.stringify('http://127.0.0.1:8010' + apiPath + '/chat')};
            using (var req = new HttpRequestMessage(HttpMethod.Post, url))
            using (var payload = new MemoryStream())
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Environment.GetEnvironmentVariable("LLM_CHAT_TOKEN"));
                req.Headers.Add("X-LLM-CSRF", "1");
                new DataContractJsonSerializer(typeof(RequestDto)).WriteObject(payload, new RequestDto { prompt = prompt, system = system });
                req.Content = new StringContent(Encoding.UTF8.GetString(payload.ToArray()), Encoding.UTF8, "application/json");
                using (var res = await Http.SendAsync(req, cancellationToken))
                {
                    var body = await res.Content.ReadAsStringAsync();
                    ResponseDto data;
                    try {
                        using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(body)))
                            data = (ResponseDto)new DataContractJsonSerializer(typeof(ResponseDto)).ReadObject(stream);
                    } catch (Exception error) { throw new InvalidOperationException("LLM sunucusu geçersiz JSON döndürdü (HTTP " + (int)res.StatusCode + ")", error); }
                    if (data == null) throw new InvalidOperationException("LLM sunucusu boş JSON yanıtı döndürdü (HTTP " + (int)res.StatusCode + ")");
                    if (!res.IsSuccessStatusCode) throw new InvalidOperationException(data.error ?? data.code ?? "LLM isteği başarısız (HTTP " + (int)res.StatusCode + ")");
                    return data.content ?? data.text ?? "";
                }
            }
        }
    }
}
`
  };
}
