import { createHmac } from "node:crypto";
import { rs } from "@rstest/core";
import { buildImWebhookRequest, imBodyOk, redactImWebhookUrl, sendImWebhook } from "./im-webhook";

describe("im webhook", () => {
  it("builds wecom markdown and feishu text", () => {
    const wecom = buildImWebhookRequest({
      channel: "wecom",
      webhookUrl: "https://qyapi.example/send?key=secret",
      text: "hello",
    });
    expect(wecom.body).toMatchObject({ msgtype: "markdown" });
    const feishu = buildImWebhookRequest({
      channel: "feishu",
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/00000000-0000-0000-0000-000000000000",
      title: "Remind",
      text: "overdue",
    });
    expect(feishu.body).toEqual({
      msg_type: "text",
      content: { text: "Remind\noverdue" },
    });
    expect(redactImWebhookUrl(feishu.url, "feishu")).toBe(
      "https://open.feishu.cn/open-apis/bot/v2/hook/***",
    );
  });

  it("signs dingtalk when secret is set", () => {
    const secret = "sec123";
    const now = 1_700_000_000_000;
    const req = buildImWebhookRequest(
      {
        channel: "dingtalk",
        webhookUrl: "https://oapi.dingtalk.com/robot/send?access_token=t",
        text: "hi",
        secret,
      },
      now,
    );
    const u = new URL(req.url);
    const expected = createHmac("sha256", secret).update(`${now}\n${secret}`).digest("base64");
    expect(u.searchParams.get("sign")).toBe(expected);
  });

  it("rejects vendor error bodies", () => {
    expect(imBodyOk("wecom", '{"errcode":0}')).toBe(true);
    expect(imBodyOk("wecom", '{"errcode":93017}')).toBe(false);
    expect(imBodyOk("feishu", '{"code":0}')).toBe(true);
    expect(imBodyOk("feishu", '{"code":19002}')).toBe(false);
  });

  it("posts and maps HTTP failure", async () => {
    const fetchImpl = rs.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "",
    });
    const result = await sendImWebhook(
      { channel: "wecom", webhookUrl: "https://qyapi.example/send", text: "x" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.delivered).toBe(false);
    expect(result.error).toBe("HTTP 500");
    expect(result.target).toBe("https://qyapi.example/send");
  });
});
