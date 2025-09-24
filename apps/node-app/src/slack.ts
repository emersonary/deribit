// index.ts
import {
  CtrlSlackAPI,
  SingleSlackMessage,
  BlockType,
} from "./slackAPI"; // path to the file
import { formatCurrency } from "./utils";

export async function sendSlackMessage(orderType: string, orderId: number, instrumentName: string, qty: number, amount: number, equity: number, fillPrice: number) {
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
  att.text = "Order ID: " + orderId +
    "\nAmount (BTC): " + formatCurrency(qty) +
    "\nTriggering Delta: " + formatCurrency(amount) +
    "\nFill Price (USD): " + formatCurrency(fillPrice) +
    "\nPrevious Equity (USD): " + formatCurrency(Math.round(equity * fillPrice * 100) / 100);
  //att.authorName = instrumentName;
  //att.title = "Slack API Documentation";
  //att.titleLink = "https://api.slack.com/";

  // Send to Slack
  const ok = await api.send("deribit", msg);
}