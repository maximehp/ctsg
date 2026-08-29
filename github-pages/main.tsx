import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The campaign app could not find its root element.");
}

createRoot(root).render(<Home />);
