import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
p.on("requestfinished", async (r) => { if (!r.url().includes("_serverFn")) return; const res = await r.response(); console.log("REQ", Buffer.from(decodeURIComponent(r.url().split("/_serverFn/")[1]!.split("?")[0]!),"base64").toString().slice(0,80)); console.log(" body", (r.postData()??"").slice(0,400)); console.log(" resp", (await res!.text()).slice(0,600)); });
await p.goto("http://127.0.0.1:5190/practice?game=target");
await p.waitForTimeout(25000);
console.log("URL", p.url());
console.log((await p.locator("body").innerText()).slice(0,500));
await b.close();
