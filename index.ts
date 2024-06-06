import Main from "./src/main";

(async () => {
  console.log("start");
  const main = new Main();
  await main.initial();
  console.log("end");
})();
