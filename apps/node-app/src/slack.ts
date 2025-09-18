// index.ts
import {
  CtrlSlackAPI,
  SingleSlackMessage,
  BlockType,
} from "./slackAPI"; // path to the file


export async function sendSlackMessage(orderType: string, instrumentName: string, amount: number, equity: number, fillPrice: number) {
  // Create controller
  const api = new CtrlSlackAPI();

  // Create message
  const msg = new SingleSlackMessage();
  msg.text = "Goldie Message";

  // Add header block
  const header = msg.listaBlock.add();
  header.blockType = BlockType.Header;
  header.text = orderType;

  // Add section block
  const section = msg.listaBlock.add();
  section.blockType = BlockType.Section;
  section.text =
    ":large_green_circle: " + instrumentName;

  // Add an attachment
  const att = msg.listaAttachment.add();
  att.text = "Amount (delta): " + amount + "\n Fill Price (USD): " + fillPrice + "\n Equity (USD): " + Math.round(equity * fillPrice * 100) / 100;
  //att.authorName = instrumentName;
  //att.title = "Slack API Documentation";
  //att.titleLink = "https://api.slack.com/";

  // Send to Slack
  const ok = await api.send("deribit", msg);
}