import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../constants";
import { LogEntry, AnalysisResult } from "../types";

// Inicializa o Gemini com a biblioteca correta
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const analyzeLogWithGemini = async (log: LogEntry): Promise<AnalysisResult> => {
  try {
    // Configura o modelo específico (Flash 1.5 ou superior)
    // Nota: Verifique se 'gemini-1.5-flash' atende sua região, pois o '2.5' pode ainda não estar estável em todos os SDKs
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            summary: { type: SchemaType.STRING },
            sentiment: { type: SchemaType.STRING },
            suggestions: { type: SchemaType.STRING }
          },
          required: ["summary", "sentiment", "suggestions"]
        },
      },
    });

    const prompt = `
      Analise o seguinte log de interação de uma IA (Dify).
      
      Inputs: ${JSON.stringify(log.inputs)}
      Outputs: ${JSON.stringify(log.outputs)}
      Erro (se houver): ${log.error || 'Nenhum'}
      Latência: ${log.latency}ms
      
      Forneça um resumo executivo, sentimento da interação (Positivo, Neutro, Negativo) e sugestões de melhoria para o prompt ou sistema.
      Responda estritamente em JSON.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("Sem resposta da IA");

    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Erro ao analisar log com Gemini:", error);
    return {
      summary: "Não foi possível analisar o log no momento.",
      sentiment: "Desconhecido",
      suggestions: "Verifique a chave de API ou tente novamente."
    };
  }
};