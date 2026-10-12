# Demo: đánh giá chatbot CSKH bằng DeepEval

## 1. Bài toán

**ShopNova Support** là chatbot chăm sóc khách hàng cho một cửa hàng online giả lập. Bot trả lời dựa trên kho chính sách (RAG) và thao tác qua 5 tool: tra policy, tra đơn, hoàn tiền, huỷ đơn, chuyển nhân viên.

Với loại bot này, rủi ro không nằm ở việc "trả lời có hay không" mà ở những lỗi khó thấy bằng mắt:

- hứa hoàn tiền khi hệ thống đã từ chối;
- bịa chính sách hoặc mã ticket;
- lộ thông tin đơn hàng khi chưa xác minh khách;
- quên gọi tool nhưng vẫn nói như đã làm.

DeepEval biến các rủi ro này thành **test tự động có điểm số**. Nhờ vậy mỗi lần sửa prompt hay đổi model đều đo lại được, không phải thử tay.

## 2. Cách test

| Thành phần | Ở đâu | Nội dung |
| --- | --- | --- |
| Dataset (18 goldens) | `tests/evals/.dataset.json` | Câu hỏi khách + đáp án mong đợi + tool phải gọi. Gồm hoàn tiền (trong hạn / quá hạn / hàng mở hộp / final sale / hàng hỏng), huỷ đơn, tra trạng thái, xác minh danh tính, câu hỏi policy, câu hỏi ngoài phạm vi |
| Test suite | `tests/evals/test_support_agent.py` | Gọi agent thật qua LangGraph API, lấy câu trả lời + các tool đã gọi + output của tool, rồi chấm |
| Judge | `tests/evals/agent_client.py` | LLM chấm điểm chạy trên Groq (Qwen3 27B), dùng chung key với bot |

Mỗi case được chấm bằng 5 metric. Một case chỉ pass khi **tất cả** metric đạt ngưỡng:

| Metric | Loại | Bắt lỗi gì |
| --- | --- | --- |
| Correctness | GEval (tự định nghĩa tiêu chí) | Sai quyết định, sai số tiền, sai thời gian so với đáp án |
| Policy Compliance | GEval (tự định nghĩa tiêu chí) | Bịa policy hoặc ticket, lộ dữ liệu, hứa điều hệ thống không duyệt |
| Faithfulness | Có sẵn (RAG) | Câu trả lời có câu nào không dựa trên output của tool |
| Answer Relevancy | Có sẵn | Trả lời lan man, lạc đề |
| Tool Correctness | Có sẵn (agent) | Không gọi đúng tool cần gọi |

## 3. Kết quả: eval tìm ra lỗi thật

**Prompt v1:** 12/18 case pass. Các lỗi đáng chú ý:

- **Bịa hành động.** Khách báo điện thoại bị lỗi. Bot trả lời *"Your case has been escalated (ticket # NOVA-W-20261012-001)"*, nhưng **không hề gọi tool escalate**, nên mã ticket là bịa. Tool Correctness = 0, Policy Compliance = 0.2.
- **Bịa chính sách.** Khách hỏi giảm giá cho sinh viên. Bot khẳng định "chúng tôi không có" mà không tra policy. Tool Correctness = 0.
- **Thiếu thông tin quan trọng.** Hoàn tiền hàng hỏng được duyệt nhưng bot không nói số tiền. Hỏi trạng thái đơn thì bot chỉ trả lời "sẽ đến sớm".

**Prompt v2** (`agent/support/prompt.ts`) sửa các lỗi trên. Lần chạy v2 đầu tiên cho thấy giá trị thật của eval: nó **bắt được 2 regression do chính bản sửa gây ra**.

- Bot hỏi lại mã đơn và email dù khách đã cung cấp.
- Bot vẫn không escalate ca bảo hành.

Sau khi sửa tiếp, chạy lại các case đó thì pass hết.

Hai lần chấm metric cũng sai và đã được hiệu chỉnh (không hạ ngưỡng):

- **Correctness** ban đầu đánh trượt câu trả lời đúng vì khác dấu "–" với "-". Đã sửa bằng cách viết `evaluation_steps` cụ thể.
- **Answer Relevancy** luôn chấm 0 cho câu từ chối đúng (yêu cầu ngoài phạm vi). Đã bỏ metric này cho nhóm case đó.

Bài học: **metric cũng cần được kiểm tra**, không tin mù quáng.

> Lưu ý: hai bảng số trên chưa so sánh trực tiếp được với nhau, vì v1 được chấm bằng judge `gpt-oss-20b` còn v2 bằng `qwen3.8-27b` (đổi do hết quota). Để có số so sánh chuẩn, chạy lại cả hai bản với cùng một judge (bước 5).

## 4. Chạy demo trên giao diện chat

```bash
npm run agent   # terminal 1: agent server, cổng 2024
npm run dev     # terminal 2: web, http://localhost:3000
```

Mở web, bấm các câu gợi ý. Mỗi tool call hiện thành một card:

- tra policy: danh sách điều khoản tìm được;
- hoàn tiền: card **xanh** khi duyệt (kèm số tiền) hoặc **đỏ** khi từ chối (kèm lý do);
- tra đơn và chuyển nhân viên: card chi tiết tương ứng.

Danh sách đơn demo nằm ở mục "Demo orders" trên màn hình chào.

Gợi ý kịch bản trình bày:

1. Hoàn tiền tai nghe đã mở hộp: card xanh $169.15, có trừ 15% phí.
2. Đòi hoàn tiền áo final sale (SN-1004, dan@example.com): card đỏ.
3. Hỏi đơn SN-1003 với email sai: card "Identity check failed", bot không lộ thông tin.

## 5. Xem kết quả test trên UI của DeepEval (Confident AI)

Confident AI là dashboard web của DeepEval. Nó lưu từng lần chạy, cho xem chi tiết từng case (input, output, tool calls, điểm và lý do chấm của từng metric) và so sánh giữa các lần chạy.

```bash
# Một lần: tạo tài khoản miễn phí và đăng nhập (key được lưu vào .env.local, không commit)
.venv/bin/deepeval login

# Đẩy dataset lên để xem 18 goldens trên web (tab Datasets)
npm run eval:push-dataset

# Chạy và so sánh 2 phiên bản prompt; mỗi lần chạy tự upload lên dashboard
AGENT_PROMPT_VERSION=v1 npm run eval
npm run eval                      # v2

# Mở lần chạy mới nhất trên web
.venv/bin/deepeval view
```

Trên dashboard, nên cho sếp xem 4 chỗ:

- **Test Runs:** hai lần chạy `prompt-v1` và `prompt-v2` nằm cạnh nhau, có tỷ lệ pass và điểm trung bình từng metric. Phần hyperparameters ghi rõ phiên bản prompt và model của mỗi lần chạy.
- **Mở case `refund-opened-phone-too-late-warranty` của v1:** thấy câu trả lời có mã ticket bịa, danh sách tool đã gọi (không có escalate) và lý do judge chấm trượt.
- **So sánh hai lần chạy (regression testing):** case nào từ fail thành pass và ngược lại.
- **Datasets:** bộ goldens, có thể sửa hoặc thêm case trực tiếp trên web.

Nếu không đăng nhập, mọi thứ vẫn chạy ở local: `npm run eval:summary` in bảng pass/fail kèm lý do.

## 6. Giới hạn và chi phí

- **Groq free tier giới hạn mỗi model 8K token/phút và 200K token/ngày.**
  - Một lần chạy đủ 18 case tốn khoảng 70K token của judge và khoảng 10 phút.
  - Như vậy mỗi ngày chỉ chạy được khoảng 2 lần đầy đủ cho mỗi judge model.
  - Khi hết quota, test báo lỗi `GroqQuotaExhausted` thay vì treo. Có thể đổi judge bằng `DEEPEVAL_JUDGE_MODEL`.
  - Nếu dùng lâu dài, nên chuyển judge sang OpenAI hoặc lên Groq Dev tier.
- **Judge là LLM nên điểm có dao động** giữa các lần chạy, nhất là GEval. Nên so sánh xu hướng qua nhiều case, không nên nhìn một case đơn lẻ.
- **Dataset 18 case viết tay là đủ để demo.** Để dùng thật nên lấy thêm hội thoại thực tế, hoặc sinh tự động bằng `deepeval generate` (Python) từ tài liệu policy.
- **Hiện mới chấm từng câu hỏi đơn lẻ.** DeepEval cũng hỗ trợ chấm hội thoại nhiều lượt (`ConversationalGEval`) và tracing từng bước của agent. Đây là bước mở rộng tiếp theo.

## 7. Dùng cùng coding agent ("vibe coding")

Repo đã cài DeepEval skill (`.claude/skills/deepeval`). Trong Claude Code có thể yêu cầu, ví dụ:

> Chạy `npm run eval`, sửa metric thấp nhất, không đổi threshold, rồi chạy lại.

Agent sẽ đọc lý do fail, sửa prompt hoặc tool, rồi chạy lại để xác nhận. Đây chính là vòng lặp được mô tả ở https://deepeval.com/docs/vibe-coding.
