import React from "react";
import ReactDOM from "react-dom/client";
import Greeting from "./view/Greeting";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Greeting />
  </React.StrictMode>,
);
