// ucSlackAPI.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

type JsonObject = Record<string, any>;

import 'dotenv/config';

export enum BlockType {
  Header = "header",
  Section = "section",
}

export class SingleBlock {
  blockType: BlockType = BlockType.Section;
  text = "";

  private subBlockTypeStr(): "plain_text" | "mrkdwn" {
    return this.blockType === BlockType.Header ? "plain_text" : "mrkdwn";
  }

  toSlackJson(): JsonObject {
    return {
      type: this.blockType,
      text: {
        type: this.subBlockTypeStr(),
        text: this.text,
      },
    };
  }
}

export class ListaBlock {
  private items: SingleBlock[] = [];
  add(): SingleBlock {
    const b = new SingleBlock();
    this.items.push(b);
    return b;
  }
  get count(): number {
    return this.items.length;
  }
  toSlackJson(): any[] {
    return this.items.map((b) => b.toSlackJson());
  }
}

export class SingleAttachment {
  text = "";
  authorName = "";
  authorLink = "";
  authorIcon = "";
  title = "";
  titleLink = "";
  imageURL = "";
  thumbURL = "";
  footer = "";
  footerIcon = "";
  timeStamp?: Date; // if not set, use current time

  toSlackJson(): JsonObject {
    const o: JsonObject = {};
    if (this.text) o.text = this.text;
    if (this.authorName) o.author_name = this.authorName;
    if (this.authorLink) o.author_link = this.authorLink;
    if (this.authorIcon) o.author_icon = this.authorIcon;
    if (this.title) o.title = this.title;
    if (this.titleLink) o.title_link = this.titleLink;
    if (this.imageURL) o.image_url = this.imageURL;
    if (this.thumbURL) o.thumb_url = this.thumbURL;
    if (this.footer) o.footer = this.footer;
    if (this.footerIcon) o.footer_icon = this.footerIcon;

    const ts =
      this.timeStamp instanceof Date ? this.timeStamp : new Date();
    // Slack expects epoch seconds for attachments.ts
    o.ts = Math.floor(ts.getTime() / 1000);

    return o;
  }
}

export class ListaAttachment {
  private items: SingleAttachment[] = [];
  add(): SingleAttachment {
    const a = new SingleAttachment();
    this.items.push(a);
    return a;
  }
  get count(): number {
    return this.items.length;
  }
  toSlackJson(): any[] {
    return this.items.map((a) => a.toSlackJson());
  }
}

export class SingleSlackMessage {
  text = "";
  listaBlock = new ListaBlock();
  listaAttachment = new ListaAttachment();
}

export class CtrlSlackAPI {
  // Keep the same configuration as your Delphi code
  private readonly token = process.env.SLACK_AUTH;
  private readonly endpoint = "https://slack.com/api/chat.postMessage";

  private blocksFromListaBlock(lista: ListaBlock): any[] | undefined {
    return lista.count > 0 ? lista.toSlackJson() : undefined;
  }

  private attachmentsFromListaAttachment(
    lista: ListaAttachment
  ): any[] | undefined {
    return lista.count > 0 ? lista.toSlackJson() : undefined;
  }

  private newJsonFromSingleSlackMessage(
    channel: string,
    msg: SingleSlackMessage
  ): JsonObject {
    const body: JsonObject = { channel };
    if (msg.text) body.text = msg.text;

    const blocks = this.blocksFromListaBlock(msg.listaBlock);
    if (blocks && blocks.length) body.blocks = blocks;

    const attachments = this.attachmentsFromListaAttachment(msg.listaAttachment);
    if (attachments && attachments.length) body.attachments = attachments;

    return body;
  }

  private async httpSend(json: JsonObject): Promise<boolean> {
    const bodyStr = JSON.stringify(json)
      .replace(/\\n/g, "\n")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      );

    const authToken = this.token
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: authToken } : {})
    };

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: bodyStr,
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data.ok === true;
    } catch {
      return text.includes('"ok":true');
    }
  }

  async send(
    channel: string,
    singleSlackMessage: SingleSlackMessage
  ): Promise<boolean> {
    const payload = this.newJsonFromSingleSlackMessage(
      channel,
      singleSlackMessage
    );
    return this.httpSend(payload);
  }
}

/* ---------- Example usage (comment out in production) ----------
(async () => {
  const api = new CtrlSlackAPI();

  const msg = new SingleSlackMessage();
  msg.text = "Sniper Message";

  const header = msg.listaBlock.add();
  header.blockType = BlockType.Header;
  header.text = "tst";

  const section = msg.listaBlock.add();
  section.blockType = BlockType.Section;
  section.text = ":large_yellow_circle: Market data farm connection is OK usfarm";

  const att = msg.listaAttachment.add();
  att.text = "Optional text that appears within the attachment";
  att.authorName = "Bobby Tables";
  att.authorLink = "http://flickr.com/bobby/";
  att.authorIcon = "http://flickr.com/icons/bobby.jpg";
  att.title = "Slack API Documentation";
  att.titleLink = "https://api.slack.com/";
  att.imageURL = "https://messagebrokerimages.s3.us-east-2.amazonaws.com/confirm5.jpg";
  att.thumbURL = "https://messagebrokerimages.s3.us-east-2.amazonaws.com/confirm5.jpg";
  att.footer = "Slack API";
  att.footerIcon = "https://platform.slack-edge.com/img/default_application_icon.png";
  // att.timeStamp = new Date(1675982482 * 1000); // optional; defaults to now

  const ok = await api.send("trades", msg);
  console.log("Sent:", ok);
})();
----------------------------------------------------------------- */
