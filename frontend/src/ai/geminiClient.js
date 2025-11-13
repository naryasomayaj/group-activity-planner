import { app } from "../firebase"; 
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: "gemini-2.5-flash-lite" });

export async function generateActivityIdeas(promptText) {
    const res = await model.generateContent([{ text: promptText }]);
    // Responses are in res.response.text() for text outputs
    return res.response.text();
}
