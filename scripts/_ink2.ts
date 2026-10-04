import { inkReferenceCheck } from "@/lib/arcade/inkBridge";
const t = performance.now(); inkReferenceCheck(104729); console.log("ms", performance.now() - t);
