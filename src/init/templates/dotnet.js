export default function dotnet() {
  // DataContractJsonSerializer supports both .NET Framework 4.x and modern .NET without NuGet.
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
            var url = Environment.GetEnvironmentVariable("LLM_MANAGER_URL") ?? "http://127.0.0.1:8010/api/llm/chat";
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
                    } catch (Exception error) { throw new InvalidOperationException("LLM server returned invalid JSON (HTTP " + (int)res.StatusCode + ")", error); }
                    if (!res.IsSuccessStatusCode) throw new InvalidOperationException(data.error ?? data.code ?? "LLM request failed");
                    return data.content ?? data.text ?? "";
                }
            }
        }
    }
}
`
  };
}
