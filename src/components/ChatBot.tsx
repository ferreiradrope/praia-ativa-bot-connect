import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Waves, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Configuração do Supabase
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://nzvdcpzndkbjmojmqskg.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmRjcHpuZGtiam1vam1xc2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1Mzk5ODcsImV4cCI6MjA2ODExNTk4N30.LzTE8DnYQRg-t7ALo9FcgqBjP_u4sVAuNtAgTYniyUo";

// Debug das variáveis de ambiente
console.log("=== DEBUG SUPABASE CONFIG ===");
console.log("VITE_SUPABASE_URL from env:", import.meta.env.VITE_SUPABASE_URL);
console.log(
  "VITE_SUPABASE_ANON_KEY from env:",
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
console.log("Final supabaseUrl:", supabaseUrl);
console.log(
  "Final supabaseAnonKey:",
  supabaseAnonKey?.substring(0, 20) + "..."
);
console.log("Comparando URLs:");
console.log("  Esperada: https://nzvdcpzndkbjmojmqskg.supabase.co");
console.log("  Atual:   ", supabaseUrl);
console.log(
  "URLs são iguais?",
  supabaseUrl === "https://nzvdcpzndkbjmojmqskg.supabase.co"
);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuração do OpenAI
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Para uso no frontend
});

// Tabelas do Supabase
const TABELA_INSTRUTORES = "praiativa_usuarios";
const TABELA_ALUNOS = "praiativa_alunos";

// Types e interfaces
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
interface ExtractedInfo {
  nome: string | null;
  atividade: string | null;
  dia_horario: string | null;
  valor: string | null;
  contato: string | null;
  localizacao: string | null;
}
interface AlunoInfo {
  nome: string | null;
  contato: string | null;
  atividade: string | null;
  observacoes: string | null;
}
interface Aluno {
  id: number;
  nome: string;
  contato: string;
  atividade: string;
  observacoes?: string;
  created_at: string;
}
type ConversationStep =
  | "initial"
  | "nome"
  | "atividade"
  | "horario"
  | "valor"
  | "contato"
  | "localizacao"
  | "finalizado"
  | "pergunta_aluno"
  | "cadastro_aluno_nome"
  | "cadastro_aluno_contato"
  | "cadastro_aluno_atividade"
  | "cadastro_aluno_escolher_atividade"
  | "cadastro_aluno_observacoes"
  | "aluno_finalizado"
  | "buscar_instrutor"
  | "escolher_tipo"
  | "login_instrutor";

export const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        'Olá! 🏖️ Seja bem-vindo à PraiAtiva!\n\nO que você quer fazer?\n\n🏄‍♂️ Digite "aluno" - para se cadastrar em atividades\n👨‍🏫 Digite "instrutor" - para oferecer atividades\n📱 Digite seu telefone - para consultar dados\n\nEscolha uma opção! 😊',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<ConversationStep>("initial");
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo>({
    nome: null,
    atividade: null,
    dia_horario: null,
    valor: null,
    contato: null,
    localizacao: null,
  });
  const [currentInstructorId, setCurrentInstructorId] = useState<number | null>(
    null
  );
  const [currentInstructorData, setCurrentInstructorData] = useState<any>(null);
  const [instructorActivities, setInstructorActivities] = useState<any[]>([]);
  const [currentAlunoInfo, setCurrentAlunoInfo] = useState<AlunoInfo>({
    nome: null,
    contato: null,
    atividade: null,
    observacoes: null,
  });
  const [alunosList, setAlunosList] = useState<Aluno[]>([]);
  const { toast } = useToast();

  // Função para buscar todas as atividades de um instrutor
  const buscarAtividadesInstrutor = async (contact: string) => {
    try {
      console.log("=== BUSCANDO ATIVIDADES DO INSTRUTOR ===");
      console.log("Contato recebido:", contact);

      const cleanContact = contact.replace(/\D/g, "");
      console.log("Contato limpo:", cleanContact);

      // Primeiro, vamos buscar TODOS os dados da tabela para debug
      console.log("🔍 Buscando todos os dados da tabela para debug...");
      const { data: allData, error: allError } = await supabase
        .from(TABELA_INSTRUTORES)
        .select("*");

      if (allError) {
        console.error("❌ Erro ao buscar todos os dados:", allError);
        return null;
      }

      console.log("📊 TODOS OS DADOS DA TABELA:", allData);
      console.log(
        "📋 Contatos disponíveis:",
        allData?.map((d) => `"${d.contato}"`) || []
      );

      if (!allData || allData.length === 0) {
        console.log("❌ Tabela vazia");
        return null;
      }

      // Buscar manualmente no array para máxima precisão
      console.log("🔍 Buscando manualmente...");
      const foundActivities = allData.filter((item) => {
        const itemContact = item.contato;
        const itemClean = itemContact?.replace(/\D/g, "") || "";

        console.log(
          `  - Comparando: "${contact}" vs "${itemContact}" (limpo: "${cleanContact}" vs "${itemClean}")`
        );

        // Múltiplas estratégias de comparação
        const matches = [
          itemContact === contact,
          itemContact === cleanContact,
          itemClean === cleanContact,
          itemClean === cleanContact && itemClean.length >= 10,
        ];

        const isMatch = matches.some((match) => match);
        if (isMatch) {
          console.log(
            `  ✅ MATCH encontrado: ${item.nome} - ${item.atividade}`
          );
        }

        return isMatch;
      });

      console.log("🎯 Atividades encontradas:", foundActivities);
      console.log("📊 Total de atividades:", foundActivities.length);

      if (foundActivities.length > 0) {
        foundActivities.forEach((atividade, index) => {
          console.log(
            `  ${index + 1}. ${atividade.nome} - ${atividade.atividade} (${
              atividade.contato
            })`
          );
        });
      }

      return foundActivities.length > 0 ? foundActivities : null;
    } catch (error) {
      console.error("💥 Erro crítico ao buscar atividades:", error);
      return null;
    }
  };

  // Função para detectar se é um número de telefone
  const isPhoneNumber = (input: string): boolean => {
    console.log("🔍 Verificando se é telefone:", input);

    // Limpar entrada removendo espaços e caracteres especiais
    const cleanInput = input.replace(/\D/g, "");
    console.log("  - Input limpo:", cleanInput);
    console.log("  - Tamanho:", cleanInput.length);

    // Verificar se tem entre 10-11 dígitos (formato brasileiro)
    if (cleanInput.length < 10 || cleanInput.length > 11) {
      console.log("  ❌ Tamanho inválido (deve ter 10-11 dígitos)");
      return false;
    }

    // Verificar se começa com códigos válidos do Brasil
    const validAreaCodes = [
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "21",
      "22",
      "24",
      "27",
      "28",
      "31",
      "32",
      "33",
      "34",
      "35",
      "37",
      "38",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
      "47",
      "48",
      "49",
      "51",
      "53",
      "54",
      "55",
      "61",
      "62",
      "63",
      "64",
      "65",
      "66",
      "67",
      "68",
      "69",
      "71",
      "73",
      "74",
      "75",
      "77",
      "79",
      "81",
      "82",
      "83",
      "84",
      "85",
      "86",
      "87",
      "88",
      "89",
      "91",
      "92",
      "93",
      "94",
      "95",
      "96",
      "97",
      "98",
      "99",
    ];
    const areaCode = cleanInput.substring(0, 2);
    console.log("  - Código de área:", areaCode);

    if (!validAreaCodes.includes(areaCode)) {
      console.log("  ❌ Código de área inválido");
      return false;
    }

    // Verificar se não é uma sequência repetitiva como 11111111111
    const isRepeating = cleanInput
      .split("")
      .every((digit) => digit === cleanInput[0]);
    if (isRepeating) {
      console.log("  ❌ Sequência repetitiva");
      return false;
    }

    console.log("  ✅ É um número de telefone válido!");
    return true;
  };

  // Função para validar nome
  const isValidName = (input: string): boolean => {
    const trimmedInput = input.trim();
    if (trimmedInput.length < 2) return false;
    if (trimmedInput.length > 50) return false;
    if (!trimmedInput) return false;

    const activityWords = [
      "futebol",
      "volei",
      "surf",
      "yoga",
      "corrida",
      "natação",
      "stand up",
      "sup",
      "paddle",
      "aula",
      "treino",
      "esporte",
      "atividade",
    ];
    const lowerInput = trimmedInput.toLowerCase();
    if (activityWords.some((word) => lowerInput.includes(word))) return false;

    const symbolCount = (trimmedInput.match(/[0-9@#$%&*()]/g) || []).length;
    if (symbolCount > 2) return false;

    const phraseWords = [
      "gostaria",
      "quero",
      "faço",
      "ofereço",
      "dou",
      "ensino",
      "tenho",
      "trabalho",
    ];
    if (phraseWords.some((word) => lowerInput.includes(word))) return false;

    return true;
  };

  // Função para verificar e inicializar tabela de alunos
  const verificarTabelaAlunos = async () => {
    try {
      console.log("🔍 Verificando tabela de alunos...");

      // Tentar fazer uma consulta simples para verificar se a tabela existe
      const { data, error } = await supabase
        .from(TABELA_ALUNOS)
        .select("id")
        .limit(1);

      if (error) {
        console.warn(
          "⚠️ Tabela de alunos não acessível:",
          error.code,
          error.message
        );
        return false;
      }

      console.log("✅ Tabela de alunos está acessível");
      return true;
    } catch (error) {
      console.error("❌ Erro ao verificar tabela de alunos:", error);
      return false;
    }
  };

  // Função para consultar dados no Supabase
  const consultarDados = async (contact: string) => {
    try {
      console.log("=== CONSULTAR DADOS ===");
      console.log("Consultando dados para:", contact);
      console.log("Tabela:", TABELA_INSTRUTORES);
      console.log("URL Supabase:", supabaseUrl);

      const cleanContact = contact.replace(/\D/g, "");
      console.log("Contato original:", contact);
      console.log("Contato limpo:", cleanContact);

      // DEBUG: Vamos ver todos os dados da tabela primeiro
      console.log("🔍 Buscando todos os dados da tabela...");
      const { data: allData, error: allError } = await supabase
        .from(TABELA_INSTRUTORES)
        .select("*");

      console.log("📊 TODOS OS DADOS DA TABELA:", allData);
      console.log("❌ ERRO AO BUSCAR TODOS:", allError);

      if (allError) {
        console.error("Erro detalhado ao buscar todos os dados:", allError);
        console.error("- Código:", allError.code);
        console.error("- Detalhes:", allError.details);
        console.error("- Hint:", allError.hint);
        console.error("- Message:", allError.message);
        return null;
      }

      if (!allData || allData.length === 0) {
        console.log("❌ Nenhum dado encontrado na tabela");
        return null;
      }

      console.log(`✅ Encontrei ${allData.length} registros na tabela`);
      console.log(
        "📋 Contatos disponíveis:",
        allData.map((d) => d.contato)
      );

      // Buscar manualmente no array retornado
      console.log("🔍 Iniciando busca manual...");

      // Estratégias de busca mais precisas para evitar falsos positivos
      const searchStrategies = [
        // 1. Busca exata do contato original
        (item: any) => item.contato === contact,
        // 2. Busca exata do contato limpo (sem formatação)
        (item: any) => item.contato === cleanContact,
        // 3. Busca comparando ambos limpos (sem caracteres especiais)
        (item: any) => item.contato?.replace(/\D/g, "") === cleanContact,
        // 4. Busca exata com formatação diferente (ex: (21)99999-9999 vs 21999999999)
        (item: any) => {
          const itemClean = item.contato?.replace(/\D/g, "") || "";
          return itemClean === cleanContact && itemClean.length >= 10;
        },
      ];

      for (let i = 0; i < searchStrategies.length; i++) {
        const strategy = searchStrategies[i];
        const found = allData.find(strategy);

        console.log(
          `🎯 Estratégia ${i + 1}:`,
          found
            ? `ENCONTRADO: ${found.nome} (${found.contato})`
            : "Não encontrado"
        );

        if (found) {
          console.log("🎉 DADOS ENCONTRADOS COM ESTRATÉGIA", i + 1, ":", found);
          console.log("🔍 COMPARAÇÃO DETALHADA:");
          console.log("  - Input original:", contact);
          console.log("  - Input limpo:", cleanContact);
          console.log("  - Contato no banco:", found.contato);
          console.log(
            "  - Contato no banco limpo:",
            found.contato?.replace(/\D/g, "")
          );
          return found;
        }
      }

      console.log("❌ Nenhum registro encontrado com nenhuma estratégia");
      console.log("🔍 Dados disponíveis para debug:");
      allData.forEach((item, index) => {
        const itemClean = item.contato?.replace(/\D/g, "") || "";
        console.log(
          `  ${index + 1}. Nome: "${item.nome}", Contato: "${
            item.contato
          }" (Limpo: "${itemClean}")`
        );
        console.log(
          `      Tamanho do contato limpo: ${itemClean.length}, Input limpo: "${cleanContact}" (Tamanho: ${cleanContact.length})`
        );
      });

      console.log("🔍 RESUMO DA BUSCA:");
      console.log("  - Input do usuário:", contact);
      console.log("  - Input limpo:", cleanContact);
      console.log("  - Tamanho do input limpo:", cleanContact.length);
      console.log("  - É telefone válido:", isPhoneNumber(contact));

      return null;
    } catch (error) {
      console.error("💥 Erro crítico ao consultar dados:", error);
      return null;
    }
  };

  // Função para salvar/atualizar dados no Supabase
  const salvarDados = async (info: ExtractedInfo) => {
    try {
      console.log("=== INICIANDO SALVAMENTO ===");
      console.log("Tabela sendo usada:", TABELA_INSTRUTORES);
      console.log("Dados recebidos:", JSON.stringify(info, null, 2));

      // Validar se todos os campos obrigatórios estão preenchidos
      if (
        !info.nome ||
        !info.atividade ||
        !info.dia_horario ||
        !info.valor ||
        !info.contato ||
        !info.localizacao
      ) {
        console.error("Dados incompletos:", info);
        throw new Error("Dados incompletos para salvamento");
      }

      console.log("Verificando se usuário já existe...");

      // Verificar se usuário já existe
      const { data: existingUser, error: selectError } = await supabase
        .from(TABELA_INSTRUTORES) // Usando nova tabela
        .select("*")
        .eq("contato", info.contato)
        .single();

      console.log("Resultado da busca:", { existingUser, selectError });

      if (existingUser && !selectError) {
        console.log("Usuário existe, atualizando...");

        // Preparar dados para atualização (sem campos de timestamp)
        const updateData = {
          nome: String(info.nome).trim(),
          atividade: String(info.atividade).trim(),
          dia_horario: String(info.dia_horario).trim(),
          valor: String(info.valor).trim(),
          localizacao: String(info.localizacao).trim(),
        };

        console.log("Dados para atualização:", updateData);

        // Atualizar usuário existente
        const { data: updatedUser, error: updateError } = await supabase
          .from(TABELA_INSTRUTORES) // Usando nova tabela
          .update(updateData)
          .eq("contato", info.contato)
          .select()
          .single();

        if (updateError) {
          console.error("Erro detalhado ao atualizar:", updateError);
          throw updateError;
        }

        console.log("Usuário atualizado com sucesso:", updatedUser);
        return { user: updatedUser, isUpdate: true };
      } else {
        console.log("Usuário não existe, criando novo...");

        // Preparar dados para inserção (sem campos de timestamp - serão preenchidos automaticamente)
        const insertData = {
          nome: String(info.nome).trim(),
          atividade: String(info.atividade).trim(),
          dia_horario: String(info.dia_horario).trim(),
          valor: String(info.valor).trim(),
          contato: String(info.contato).trim(),
          localizacao: String(info.localizacao).trim(),
        };

        console.log("Dados para inserção:", insertData);

        // Criar novo usuário
        const { data: newUser, error: insertError } = await supabase
          .from(TABELA_INSTRUTORES) // Usando nova tabela
          .insert([insertData])
          .select()
          .single();

        if (insertError) {
          console.error("Erro detalhado ao inserir:", insertError);
          console.error("Código do erro:", insertError.code);
          console.error("Detalhes do erro:", insertError.details);
          console.error("Mensagem do erro:", insertError.message);
          throw insertError;
        }

        console.log("Usuário criado com sucesso:", newUser);
        return { user: newUser, isUpdate: false };
      }
    } catch (error) {
      console.error("=== ERRO NO SALVAMENTO ===");
      console.error("Tipo do erro:", typeof error);
      console.error("Erro completo:", error);
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "N/A"
      );
      throw error;
    }
  };

  // Função para gerar resposta com IA
  const generateAIResponse = async (
    context: string,
    step: string,
    userMessage: string
  ): Promise<string> => {
    try {
      console.log("🤖 === GERANDO RESPOSTA AI ===");
      console.log("- Context:", context);
      console.log("- Step:", step);
      console.log("- UserMessage:", userMessage);
      console.log(
        "- OpenAI API Key:",
        import.meta.env.VITE_OPENAI_API_KEY ? "✅ Definida" : "❌ Não definida"
      );

      let systemPrompt = "";

      // Definir contexto baseado no passo atual
      switch (step) {
        case "inicio":
          systemPrompt = `Você é um assistente virtual para cadastro de instrutores de atividades na praia. 
          Seja amigável e explique que o usuário pode se cadastrar como instrutor ou consultar seus dados.
          Mantenha a resposta curta e direcionada.`;
          break;

        case "pergunta_aluno":
          systemPrompt = `O instrutor acabou de se cadastrar com sucesso. 
          Pergunte de forma natural e entusiasmada se ele gostaria de cadastrar alunos para suas atividades.
          Explique que isso ajuda a organizar e ampliar suas atividades na praia.`;
          break;

        case "nome":
        case "cadastro_nome":
        case "cadastro_aluno_nome":
          systemPrompt = `Você está coletando o nome da pessoa. 
          Seja amigável e peça o nome completo de forma natural.`;
          break;

        case "cadastro_atividade":
          systemPrompt = `O usuário se apresentou. Agora pergunte que tipo de atividade na praia ele oferece.
          Seja entusiasmado, use emojis de praia, e dê exemplos como: surf, vôlei, futebol, yoga, etc.`;
          break;

        case "cadastro_horario":
          systemPrompt = `O usuário informou a atividade. Agora pergunte sobre dias e horários disponíveis.
          Seja específico pedindo dias da semana e horários. Mencione que isso ajuda os alunos a se programarem.`;
          break;

        case "cadastro_valor":
          systemPrompt = `O usuário informou horários. Agora pergunte sobre o valor cobrado pela atividade.
          Seja direto mas amigável. Explique que é importante para os alunos saberem o investimento.`;
          break;

        case "cadastro_contato":
        case "cadastro_aluno_contato":
          systemPrompt = `Você está coletando contato (telefone/WhatsApp). 
          Explique que é para facilitar comunicação sobre as atividades e marcar horários.`;
          break;

        case "cadastro_localizacao":
          systemPrompt = `O usuário informou contato. Agora pergunte em qual praia ou região ele oferece a atividade.
          Seja específico pedindo nome da praia, bairro ou área de atuação.`;
          break;

        case "cadastro_aluno_atividade":
          systemPrompt = `Você está perguntando sobre a atividade que o aluno quer participar. 
          Seja específico e entusiasmado sobre atividades na praia.`;
          break;

        case "cadastro_observacoes":
        case "cadastro_aluno_observacoes":
          systemPrompt = `Você está coletando observações finais. 
          Explique que é opcional e podem adicionar informações como: experiência, objetivos, restrições, etc.`;
          break;

        case "aluno_finalizado":
          systemPrompt = `O aluno foi cadastrado com sucesso. Celebre o sucesso!
          Seja entusiasmado e explique que agora o instrutor pode organizar melhor suas atividades.`;
          break;

        case "fim_conversa":
          systemPrompt = `O usuário não quer continuar ou fazer cadastro de aluno. 
          Finalize de forma amigável, positiva e deixe a porta aberta para futuros contatos.`;
          break;

        case "resposta_generica":
          systemPrompt = `O usuário disse algo inesperado ou fora do fluxo normal. 
          Você precisa ser inteligente e:
          1. Se parece ser um nome → direcione para cadastro de instrutor
          2. Se parece ser um número → direcione para consulta 
          3. Se parece confuso → explique as opções disponíveis
          4. Se parece uma pergunta → responda de forma útil e redirecione
          Seja sempre amigável e mantenha o foco nas atividades de praia.`;
          break;

        default:
          systemPrompt = `Você é um assistente especializado em atividades na praia. 
          O usuário disse algo que não se encaixa no fluxo padrão. Seja inteligente:
          - Tente entender a intenção do usuário
          - Responda de forma útil 
          - Redirecione para as opções disponíveis: cadastro ou consulta
          - Mantenha sempre o foco em atividades de praia
          - Seja amigável e use emojis apropriados`;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `${systemPrompt}
            
            REGRAS IMPORTANTES:
            - Seja sempre amigável e use emojis apropriados
            - Mantenha respostas entre 20-80 palavras
            - Use linguagem natural e brasileira
            - Para perguntas sobre dados, seja específico sobre o que está pedindo
            - Evite repetir informações já mencionadas
            - Use "você" ao invés de "tu"
            - Seja entusiasmado sobre atividades na praia`,
          },
          {
            role: "user",
            content: `Contexto: ${context}. Mensagem do usuário: ${userMessage}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      const aiResponse =
        completion.choices[0]?.message?.content ||
        "Desculpe, não consegui processar sua mensagem. Pode tentar novamente?";
      console.log("✅ Resposta recebida da IA:", aiResponse);
      return aiResponse;
    } catch (error) {
      console.error("❌ Erro ao gerar resposta AI:", error);
      console.error("- Tipo do erro:", typeof error);
      console.error(
        "- Mensagem:",
        error instanceof Error ? error.message : "Erro desconhecido"
      );
      return "Estou tendo dificuldades técnicas. Vou usar uma resposta padrão para continuar.";
    }
  };

  const sendMessage = async () => {
    console.log("===== DEBUG SENDMESSAGE =====");
    console.log("currentStep:", currentStep);
    console.log("input before clear:", input);
    console.log("extractedInfo atual:", extractedInfo);
    console.log("currentInstructorData:", currentInstructorData);
    console.log("currentInstructorId:", currentInstructorId);
    console.log("instructorActivities:", instructorActivities);

    if (!input.trim() || isLoading) return;
    const currentInput = input;
    // Registrar mensagem do usuário
    const userMessage: Message = {
      role: "user",
      content: currentInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    // Limpar campo de input
    setInput("");
    setIsLoading(true);

    try {
      // Aguardar um pouco para simular processamento
      await new Promise((resolve) => setTimeout(resolve, 500));

      // PRIMEIRA PRIORIDADE: Verificar se é consulta OU se é um número que pode estar cadastrado
      const isConsultationRequest =
        (currentStep === "initial" && isPhoneNumber(currentInput)) ||
        currentInput.toLowerCase().includes("consultar") ||
        currentInput.toLowerCase().includes("meus dados");

      console.log("=== DEBUG CONSULTA ===");
      console.log("currentStep:", currentStep);
      console.log("currentInput:", currentInput);
      console.log("isPhoneNumber resultado:", isPhoneNumber(currentInput));
      console.log(
        "includes consultar:",
        currentInput.toLowerCase().includes("consultar")
      );
      console.log(
        "includes meus dados:",
        currentInput.toLowerCase().includes("meus dados")
      );
      console.log("isConsultationRequest final:", isConsultationRequest);

      // NOVA PRIORIDADE: Verificar se instrutor quer cadastrar ALUNOS
      const isInstrutorCadastroAluno =
        currentInput.toLowerCase().includes("cadastrar aluno") ||
        currentInput.toLowerCase().includes("quero cadastrar aluno") ||
        currentInput.toLowerCase().includes("cadastrar meus aluno") ||
        currentInput.toLowerCase().includes("aluno no meu cadastro") ||
        currentInput.toLowerCase().includes("cadastrar alunos") ||
        currentInput.toLowerCase().includes("adicionar aluno");

      console.log("=== DEBUG CADASTRO ALUNO INSTRUTOR ===");
      console.log("isInstrutorCadastroAluno:", isInstrutorCadastroAluno);

      if (isInstrutorCadastroAluno && currentStep === "initial") {
        console.log("✅ Instrutor quer cadastrar alunos");

        const response =
          "Para cadastrar alunos em sua atividade, digite seu telefone de instrutor:";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setCurrentStep("login_instrutor"); // Novo step
        setIsLoading(false);
        return;
      }

      // SEGUNDA PRIORIDADE: Verificar se é uma tentativa de cadastro
      const isCadastroRequest =
        currentInput.toLowerCase().includes("cadastrar") ||
        currentInput.toLowerCase().includes("quero cadastrar") ||
        currentInput.toLowerCase().includes("cadastrar atividade") ||
        currentInput.toLowerCase().includes("cadastrar minha");

      // NOVA PRIORIDADE: Verificar se quer se cadastrar como ALUNO
      const isAlunoRequest =
        currentInput.toLowerCase().includes("aluno") ||
        currentInput.toLowerCase().includes("sou aluno") ||
        currentInput.toLowerCase().includes("me cadastrar como aluno") ||
        currentInput.toLowerCase().includes("quero ser aluno") ||
        currentInput.toLowerCase().includes("participar");

      // VERIFICAR se quer se cadastrar como INSTRUTOR
      const isInstrutorRequest =
        currentInput.toLowerCase().includes("instrutor") ||
        currentInput.toLowerCase().includes("sou instrutor") ||
        currentInput.toLowerCase().includes("me cadastrar como instrutor") ||
        currentInput.toLowerCase().includes("quero ser instrutor") ||
        currentInput.toLowerCase().includes("dar aula") ||
        currentInput.toLowerCase().includes("ensinar");

      console.log("=== DEBUG CADASTRO ===");
      console.log("isCadastroRequest:", isCadastroRequest);
      console.log("isAlunoRequest:", isAlunoRequest);
      console.log("isInstrutorRequest:", isInstrutorRequest);

      if (isCadastroRequest && currentStep === "initial") {
        console.log("✅ Usuário quer fazer cadastro");
        const intelligentResponse = await generateAIResponse(
          `Usuário quer cadastrar atividade: "${currentInput}"`,
          "resposta_generica",
          currentInput
        );

        const response =
          intelligentResponse ||
          "Perfeito! Vou te ajudar a cadastrar sua atividade na praia! 🏖️ Primeiro, me diga seu nome:";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setIsLoading(false);
        return;
      }

      // NOVO: Lidar com cadastro de ALUNO
      if (isAlunoRequest && currentStep === "initial") {
        console.log("✅ Usuário quer se cadastrar como ALUNO");

        const response =
          "Ótimo! 🏖️ Para te cadastrar como aluno, preciso do telefone do **instrutor** da atividade:\n\n📱 Digite o telefone do **instrutor** (não o seu):\n💡 Ex: 21999887766";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setCurrentStep("buscar_instrutor");
        setIsLoading(false);
        return;
      }

      // NOVO: Lidar com cadastro de INSTRUTOR
      if (isInstrutorRequest && currentStep === "initial") {
        console.log("✅ Usuário quer se cadastrar como INSTRUTOR");

        const response = "Perfeito! 🏖️ Primeiro, seu nome:";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setCurrentStep("nome");
        setIsLoading(false);
        return;
      }

      // NOVO: Lidar com busca de instrutor para cadastro de aluno
      if (currentStep === "buscar_instrutor") {
        console.log(
          "🔍 Buscando instrutor para cadastro de aluno:",
          currentInput
        );

        // Verificar se o usuário quer voltar
        if (currentInput.toLowerCase().trim() === "voltar") {
          const response =
            'Tudo bem! Vamos recomeçar. 😊\n\nO que você gostaria de fazer?\n\n👨‍🏫 Digite "instrutor" para se cadastrar como instrutor\n🏄‍♂️ Digite "aluno" para se cadastrar como aluno\n📱 Digite seu telefone para consultar dados';

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setCurrentStep("initial");
          setIsLoading(false);
          return;
        }

        // Verificar se é um número válido
        if (!isPhoneNumber(currentInput)) {
          const response =
            "Por favor, digite um telefone válido do **instrutor**:\n📱 Ex: 21999887766\n💡 Este deve ser o telefone do instrutor, não o seu!";

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // Buscar o instrutor no banco
        const allActivities = await buscarAtividadesInstrutor(currentInput);

        if (allActivities && allActivities.length > 0) {
          console.log(
            "✅ Instrutor encontrado com",
            allActivities.length,
            "atividade(s)"
          );

          // Se tem apenas uma atividade, usar o fluxo otimizado
          if (allActivities.length === 1) {
            const instrutorData = allActivities[0];

            console.log(
              "🎯 DEFININDO DADOS DO INSTRUTOR (UMA ATIVIDADE):",
              instrutorData
            );

            setCurrentInstructorId(instrutorData.id);
            setCurrentInstructorData(instrutorData);
            setInstructorActivities([instrutorData]);

            const response = `✅ ${instrutorData.nome} - ${instrutorData.atividade}\n💰 ${instrutorData.valor} | ⏰ ${instrutorData.dia_horario}\n📍 ${instrutorData.localizacao}\n\n🎯 Atividade: ${instrutorData.atividade} (única disponível)\n\nSeu nome:`;

            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setCurrentStep("cadastro_aluno_nome");
            setIsLoading(false);
            return;
          } else {
            // Múltiplas atividades - mostrar opções
            setInstructorActivities(allActivities);
            setCurrentInstructorData(allActivities[0]); // Usar dados básicos do primeiro
            setCurrentInstructorId(allActivities[0].id);

            let response = `✅ ${allActivities[0].nome} oferece várias atividades:\n\n`;
            allActivities.forEach((atividade, index) => {
              response += `${index + 1}. ${atividade.atividade}\n💰 ${
                atividade.valor
              } | ⏰ ${atividade.dia_horario}\n📍 ${atividade.localizacao}\n\n`;
            });
            response += `Digite o número da atividade que você quer:`;

            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setCurrentStep("cadastro_aluno_escolher_atividade");
            setIsLoading(false);
            return;
          }
        } else {
          console.log("❌ Instrutor não encontrado");

          const response =
            '❌ Não encontrei nenhuma atividade cadastrada para este telefone.\n\n💡 **Lembre-se**: você deve informar o telefone do **instrutor**, não o seu!\n\nVerifique se:\n• O número do instrutor está correto\n• O instrutor já se cadastrou no sistema\n\n🔄 Tente outro número ou digite "voltar":';

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // NOVO: Login do instrutor para cadastrar alunos
      if (currentStep === "login_instrutor") {
        console.log("🔍 Fazendo login do instrutor:", currentInput);

        // Verificar se o usuário quer voltar
        if (currentInput.toLowerCase().trim() === "voltar") {
          const response =
            'Digite:\n• **"aluno"** - participar de atividades\n• **"instrutor"** - oferecer atividades\n• Seu **telefone** - consultar dados';

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setCurrentStep("initial");
          setIsLoading(false);
          return;
        }

        // Verificar se é um número válido
        if (!isPhoneNumber(currentInput)) {
          const response = "Telefone inválido. Digite seu número de instrutor:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // Buscar o instrutor no banco
        const allActivities = await buscarAtividadesInstrutor(currentInput);

        if (allActivities && allActivities.length > 0) {
          console.log(
            "✅ Instrutor logado com",
            allActivities.length,
            "atividade(s)"
          );

          // Se tem apenas uma atividade, usar o fluxo otimizado
          if (allActivities.length === 1) {
            const instrutorData = allActivities[0];

            console.log(
              "🎯 DEFININDO DADOS DO INSTRUTOR (LOGIN - UMA ATIVIDADE):",
              instrutorData
            );

            setCurrentInstructorId(instrutorData.id);
            setCurrentInstructorData(instrutorData);
            setInstructorActivities([instrutorData]);

            const response = `✅ ${instrutorData.nome} logado!\n🎯 Atividade: ${instrutorData.atividade}\n💰 ${instrutorData.valor} | ⏰ ${instrutorData.dia_horario}\n\nNome do novo aluno:`;

            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setCurrentStep("cadastro_aluno_nome");
            setIsLoading(false);
            return;
          } else {
            // Múltiplas atividades - mostrar opções
            setInstructorActivities(allActivities);
            setCurrentInstructorData(allActivities[0]);
            setCurrentInstructorId(allActivities[0].id);

            let response = `✅ ${allActivities[0].nome} logado!\n\nVocê oferece várias atividades:\n\n`;
            allActivities.forEach((atividade, index) => {
              response += `${index + 1}. ${atividade.atividade}\n💰 ${
                atividade.valor
              } | ⏰ ${atividade.dia_horario}\n\n`;
            });
            response += `Para qual atividade quer cadastrar o aluno? Digite o número:`;

            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setCurrentStep("cadastro_aluno_escolher_atividade");
            setIsLoading(false);
            return;
          }
        } else {
          const response =
            '❌ Instrutor não encontrado. Verifique o número ou digite "voltar":';
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // NOVO: Escolha de atividade quando instrutor tem múltiplas atividades
      if (currentStep === "cadastro_aluno_escolher_atividade") {
        console.log("🎯 Escolhendo atividade:", currentInput);
        console.log("Atividades disponíveis:", instructorActivities);

        // Verificar se o usuário quer voltar
        if (currentInput.toLowerCase().trim() === "voltar") {
          const response =
            'Voltando ao início...\n\n🏄‍♂️ Digite "aluno" - participar de atividades\n👨‍🏫 Digite "instrutor" - oferecer atividades\n📱 Digite seu telefone - consultar dados';

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setCurrentStep("initial");
          setInstructorActivities([]);
          setCurrentInstructorData(null);
          setCurrentInstructorId(null);
          setIsLoading(false);
          return;
        }

        // Verificar se é um número válido
        const numeroEscolhido = parseInt(currentInput.trim());
        if (
          isNaN(numeroEscolhido) ||
          numeroEscolhido < 1 ||
          numeroEscolhido > instructorActivities.length
        ) {
          const response = `Por favor, digite um número de **1** a **${instructorActivities.length}**:`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // Selecionar a atividade escolhida
        const atividadeEscolhida = instructorActivities[numeroEscolhido - 1];
        console.log("✅ Atividade selecionada:", atividadeEscolhida);

        // Atualizar os dados do instrutor com a atividade específica
        setCurrentInstructorData(atividadeEscolhida);
        setCurrentInstructorId(atividadeEscolhida.id);

        const response = `🎯 ${atividadeEscolhida.atividade} selecionada!\n💰 ${atividadeEscolhida.valor} | ⏰ ${atividadeEscolhida.dia_horario}\n📍 ${atividadeEscolhida.localizacao}\n\nNome do aluno:`;

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setCurrentStep("cadastro_aluno_nome");
        setIsLoading(false);
        return;
      }

      // NOVO: Lidar com escolha de tipo após informar o nome
      if (currentStep === "escolher_tipo") {
        const lowerInput = currentInput.toLowerCase().trim();

        if (
          lowerInput.includes("instrutor") ||
          lowerInput.includes("ensinar") ||
          lowerInput.includes("oferecer")
        ) {
          const nomeJaSalvo = extractedInfo.nome;
          const response = `Ótimo ${nomeJaSalvo}! Que atividade você oferece?`;

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setCurrentStep("atividade");
          setIsLoading(false);
          return;
        } else if (
          lowerInput.includes("aluno") ||
          lowerInput.includes("participar") ||
          lowerInput.includes("aprender")
        ) {
          const response = `Perfeito! Digite o telefone do instrutor:`;

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setCurrentStep("buscar_instrutor");
          setIsLoading(false);
          return;
        } else {
          const response = `Digite "instrutor" ou "aluno":`;

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // fluxo consulta OU verificação de número no step inicial
      if (isConsultationRequest) {
        console.log("✅ É uma consulta ou número no step inicial");

        // Se contém palavra "consultar" mas não tem número, pedir o número
        if (!isPhoneNumber(currentInput)) {
          console.log("❌ Não é um número válido, pedindo número");
          const intelligentResponse = await generateAIResponse(
            "Usuário quer consultar dados mas não informou número",
            "resposta_generica",
            currentInput
          );
          const finalResponse =
            intelligentResponse ||
            "Para consultar seus dados, preciso do seu número de telefone. Digite apenas os números (ex: 21999887766):";
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: finalResponse,
              timestamp: new Date(),
            },
          ]);
          setIsLoading(false);
          return;
        }

        console.log("✅ É um número válido, consultando dados...");
        console.log("📞 Número para consulta:", currentInput);
        console.log("📞 Número limpo:", currentInput.replace(/\D/g, ""));

        // Tem um número - verificar se existe no banco
        const userData = await consultarDados(currentInput);
        console.log("📊 Resultado da consulta:", userData);

        if (userData) {
          console.log("🎉 USUÁRIO ENCONTRADO:", userData);
          // USUÁRIO ENCONTRADO - mostrar dados
          try {
            console.log("🔍 Buscando alunos para instrutor ID:", userData.id);

            // Verificar se a tabela de alunos está acessível
            const tabelaAlunosOk = await verificarTabelaAlunos();

            let alunosTexto = "Sistema de alunos em configuração...";

            if (tabelaAlunosOk) {
              // DEBUG: Buscar TODOS os alunos primeiro para verificar os dados
              console.log(
                "🔍 DEBUG: Buscando TODOS os alunos para verificar dados..."
              );
              const { data: todosAlunos, error: debugError } = await supabase
                .from(TABELA_ALUNOS)
                .select("*");

              console.log("📊 TODOS OS ALUNOS NO BANCO:", todosAlunos);
              console.log("❌ ERRO DEBUG:", debugError);

              // Agora buscar apenas os alunos deste instrutor
              console.log(
                `🎯 Buscando alunos especificamente para instrutor_id: ${userData.id}`
              );
              const { data: alunos, error: alunosError } = await supabase
                .from(TABELA_ALUNOS)
                .select(
                  "nome, contato, atividade, observacoes, created_at, instrutor_id"
                )
                .eq("instrutor_id", userData.id)
                .order("created_at", { ascending: false });

              console.log(
                `📋 ALUNOS FILTRADOS (instrutor_id=${userData.id}):`,
                alunos
              );
              console.log("❌ ERRO AO BUSCAR ALUNOS FILTRADOS:", alunosError);

              if (alunosError) {
                console.log("⚠️ Erro ao buscar alunos:", alunosError);
                alunosTexto = "Erro ao carregar alunos...";
              } else if (alunos && alunos.length > 0) {
                console.log(
                  `✅ Encontrados ${alunos.length} alunos para este instrutor`
                );
                alunosTexto = alunos
                  .map((a, i) => {
                    const obs =
                      a.observacoes && a.observacoes.trim()
                        ? ` - ${a.observacoes}`
                        : "";
                    return `${i + 1}. **${a.nome}** (${a.contato}) - *${
                      a.atividade
                    }*${obs}`;
                  })
                  .join("\n");
              } else {
                console.log("ℹ️ Nenhum aluno encontrado para este instrutor");
                alunosTexto = "Nenhum aluno cadastrado ainda.";
              }
            }

            // SEMPRE mostrar os dados completos, sem depender da IA
            const response = `🎉 Encontrei seu cadastro!\n\n👤 Nome: ${userData.nome}\n🏖️ Atividade: ${userData.atividade}\n⏰ Horário: ${userData.dia_horario}\n💰 Valor: ${userData.valor}\n📞 Contato: ${userData.contato}\n📍 Localização: ${userData.localizacao}\n\n👥 Alunos cadastrados:\n${alunosTexto}\n\n✨ Tudo certo com seus dados! Se precisar atualizar algo, é só fazer um novo cadastro com o mesmo número! 😊`;

            console.log("📝 Resposta final enviada:", response);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
          } catch (alunosErr) {
            console.error("Erro ao buscar alunos:", alunosErr);
            // Mesmo com erro de alunos, mostrar dados do instrutor
            const response = `🎉 Encontrei seu cadastro!\n\n👤 Nome: ${userData.nome}\n🏖️ Atividade: ${userData.atividade}\n⏰ Horário: ${userData.dia_horario}\n💰 Valor: ${userData.valor}\n📞 Contato: ${userData.contato}\n📍 Localização: ${userData.localizacao}\n\n👥 Alunos: Sistema de alunos em manutenção\n\n✨ Tudo certo com seus dados! Se precisar atualizar algo, é só fazer um novo cadastro com o mesmo número! 😊`;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
          }
        } else {
          console.log("❌ USUÁRIO NÃO ENCONTRADO");
          // USUÁRIO NÃO ENCONTRADO - oferecer cadastro
          const intelligentResponse = await generateAIResponse(
            `Não encontrei cadastro para o número ${currentInput}`,
            "resposta_generica",
            "Número não encontrado"
          );

          const response =
            intelligentResponse ||
            "Não encontrei cadastro com esse número. Gostaria de se cadastrar como instrutor? Se sim, me diga seu nome! 🏖️";

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
        }
        setIsLoading(false);
        return;
      }

      // etapas cadastro de aluno
      if (
        currentStep === "pergunta_aluno" ||
        currentStep === "aluno_finalizado"
      ) {
        const ans = currentInput.trim().toLowerCase();

        // Aceitar várias formas de "sim" e "não", incluindo "cadastrar aluno"
        const respostasSim = [
          "sim",
          "s",
          "yes",
          "quero",
          "gostaria",
          "vamos",
          "claro",
          "cadastrar aluno",
          "novo aluno",
          "mais um",
        ];
        const respostasNao = [
          "não",
          "nao",
          "n",
          "no",
          "agora não",
          "agora nao",
          "depois",
          "talvez",
          "tchau",
          "obrigado",
          "obrigada",
        ];

        const isSim = respostasSim.some((resp) => ans.includes(resp));
        const isNao = respostasNao.some((resp) => ans.includes(resp));

        if (isSim) {
          console.log(
            "✅ Instrutor quer cadastrar aluno - usando dados já cadastrados"
          );
          console.log("📊 Dados do instrutor recém-cadastrado:", extractedInfo);

          // Configurar dados do instrutor com base no cadastro que acabou de fazer
          const instrutorData = {
            nome: extractedInfo.nome,
            atividade: extractedInfo.atividade,
            dia_horario: extractedInfo.dia_horario,
            valor: extractedInfo.valor,
            contato: extractedInfo.contato,
            localizacao: extractedInfo.localizacao,
          };

          setCurrentInstructorData(instrutorData);
          setInstructorActivities([instrutorData]); // Só tem uma atividade

          // Pré-definir a atividade do aluno com base na atividade do instrutor
          const alunoInfo = {
            ...currentAlunoInfo,
            atividade: extractedInfo.atividade,
          };
          setCurrentAlunoInfo(alunoInfo);

          setCurrentStep("cadastro_aluno_nome");
          const response = `🎯 Cadastrando aluno para: **${extractedInfo.atividade}**\n💰 Valor: ${extractedInfo.valor} | ⏰ ${extractedInfo.dia_horario}\n📍 ${extractedInfo.localizacao}\n\nNome do aluno:`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
        } else if (isNao) {
          const response = "Perfeito! Seus dados estão salvos! 😊";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setCurrentStep("initial");
          // Resetar dados para próxima interação
          setExtractedInfo({
            nome: null,
            atividade: null,
            dia_horario: null,
            valor: null,
            contato: null,
            localizacao: null,
          });
          setCurrentAlunoInfo({
            nome: null,
            contato: null,
            atividade: null,
            observacoes: null,
          });
          setCurrentInstructorId(null);
          setCurrentInstructorData(null);
          setInstructorActivities([]);
        } else {
          const response =
            'Digite "sim" para cadastrar outro aluno ou "não" para finalizar:';
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
        }
        setIsLoading(false);
        return;
      }
      if (currentStep === "cadastro_aluno_nome") {
        // Validar se parece ser um nome
        if (currentInput.trim().length < 2 || currentInput.trim().length > 50) {
          const response = "Nome muito curto ou longo. Tente novamente:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }
        const aux = { ...currentAlunoInfo, nome: currentInput.trim() };
        setCurrentAlunoInfo(aux);
        setCurrentStep("cadastro_aluno_contato");
        const response = `Seu telefone/WhatsApp:`;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setIsLoading(false);
        return;
      }
      if (currentStep === "cadastro_aluno_contato") {
        console.log("📱 STEP cadastro_aluno_contato - processando contato");
        console.log("🔍 Input do usuário:", currentInput);
        console.log("🔍 currentInstructorData:", currentInstructorData);
        console.log("🔍 instructorActivities:", instructorActivities);

        // Validar se parece ser um contato
        const cleanContact = currentInput.replace(/\D/g, "");
        if (cleanContact.length < 8 || cleanContact.length > 15) {
          const response = "Telefone inválido. Digite novamente:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // Se JÁ TEMOS dados do instrutor (cenário pós-cadastro), usar diretamente
        if (
          currentInstructorData &&
          currentInstructorData.atividade &&
          instructorActivities.length > 0
        ) {
          console.log("✅ Já temos dados do instrutor - usando diretamente");

          const aux = {
            ...currentAlunoInfo,
            contato: currentInput.trim(),
            atividade: currentInstructorData.atividade, // Já foi definida antes
          };
          setCurrentAlunoInfo(aux);
          setCurrentStep("cadastro_aluno_observacoes");
          const response = `✅ Atividade: **${currentInstructorData.atividade}**\n💰 Valor: ${currentInstructorData.valor}\n⏰ Horário: ${currentInstructorData.dia_horario}\n📍 Local: ${currentInstructorData.localizacao}\n\nAlguma observação? (opcional - digite "não" se não tiver)`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // APENAS se não temos dados do instrutor (cenário: aluno chegou direto), buscar no banco
        console.log("🔍 Não temos dados do instrutor - buscando no banco...");

        try {
          const allActivities = await buscarAtividadesInstrutor(
            currentInput.trim()
          );
          console.log("🔍 Resultado da busca:", allActivities);

          if (allActivities && allActivities.length > 0) {
            console.log(
              "✅ Encontradas",
              allActivities.length,
              "atividades para este instrutor"
            );

            // Atualizar estados
            setInstructorActivities(allActivities);
            setCurrentInstructorData(allActivities[0]);

            // Se o instrutor tem APENAS UMA atividade → usar automaticamente
            if (allActivities.length === 1) {
              const atividadeUnica = allActivities[0];
              console.log(
                "🎯 UMA ATIVIDADE: Selecionando automaticamente:",
                atividadeUnica.atividade
              );

              const aux = {
                ...currentAlunoInfo,
                contato: currentInput.trim(),
                atividade: atividadeUnica.atividade,
              };
              setCurrentAlunoInfo(aux);
              setCurrentStep("cadastro_aluno_observacoes");
              const response = `✅ Atividade: **${atividadeUnica.atividade}** (única oferecida por ${atividadeUnica.nome})\n💰 Valor: ${atividadeUnica.valor}\n⏰ Horário: ${atividadeUnica.dia_horario}\n📍 Local: ${atividadeUnica.localizacao}\n\nAlguma observação? (opcional - digite "não" se não tiver)`;
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: response, timestamp: new Date() },
              ]);
              setIsLoading(false);
              return;
            }

            // Se o instrutor tem MÚLTIPLAS atividades → mostrar opções específicas dele
            else {
              console.log(
                "🎯 MÚLTIPLAS ATIVIDADES: Mostrando",
                allActivities.length,
                "opções do instrutor"
              );

              const aux = { ...currentAlunoInfo, contato: currentInput.trim() };
              setCurrentAlunoInfo(aux);

              let response = `📋 ${allActivities[0].nome} oferece ${allActivities.length} atividades:\n\n`;
              allActivities.forEach((atividade, index) => {
                response += `${index + 1}. **${atividade.atividade}**\n💰 ${
                  atividade.valor
                } | ⏰ ${atividade.dia_horario}\n📍 ${
                  atividade.localizacao
                }\n\n`;
              });
              response += `Qual atividade você quer? Digite o número (1-${allActivities.length}):`;

              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: response, timestamp: new Date() },
              ]);
              setCurrentStep("cadastro_aluno_escolher_atividade");
              setIsLoading(false);
              return;
            }
          } else {
            console.log("❌ Nenhuma atividade encontrada para este instrutor");
            const response = `❌ Não encontrei nenhuma atividade cadastrada para este telefone.\n\nVerifique se:\n• O número está correto\n• O instrutor já se cadastrou no sistema\n\nTente novamente ou digite outro telefone:`;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("❌ Erro ao buscar atividades:", error);
          const response =
            "Erro ao buscar dados do instrutor. Tente novamente:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }
      }
      if (currentStep === "cadastro_aluno_atividade") {
        console.log(
          "⚠️ CHEGOU NO STEP cadastro_aluno_atividade - isso não deveria acontecer se temos instrutor específico!"
        );
        console.log("🔍 DEBUG currentInstructorData:", currentInstructorData);
        console.log("🔍 DEBUG instructorActivities:", instructorActivities);

        // VERIFICAÇÃO: Se temos dados específicos do instrutor, FORÇAR o uso da atividade dele
        if (currentInstructorData?.atividade) {
          console.log(
            "🔧 CORRIGINDO: Forçando atividade do instrutor:",
            currentInstructorData.atividade
          );
          const aux = {
            ...currentAlunoInfo,
            atividade: currentInstructorData.atividade,
          };
          setCurrentAlunoInfo(aux);
          setCurrentStep("cadastro_aluno_observacoes");
          const response = `🔧 Corrigido: Atividade **${currentInstructorData.atividade}**\n💰 Valor: ${currentInstructorData.valor}\n⏰ Horário: ${currentInstructorData.dia_horario}\n\nAlguma observação? (opcional)`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // Se chegou aqui e temos instructorActivities, usar o primeiro
        if (instructorActivities && instructorActivities.length > 0) {
          console.log(
            "🔧 CORRIGINDO: Usando primeira atividade disponível:",
            instructorActivities[0].atividade
          );
          const instrutorData = instructorActivities[0];
          setCurrentInstructorData(instrutorData);
          const aux = {
            ...currentAlunoInfo,
            atividade: instrutorData.atividade,
          };
          setCurrentAlunoInfo(aux);
          setCurrentStep("cadastro_aluno_observacoes");
          const response = `� Corrigido: Atividade **${instrutorData.atividade}**\n💰 Valor: ${instrutorData.valor}\n⏰ Horário: ${instrutorData.dia_horario}\n\nAlguma observação? (opcional)`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // Se não tem dados do instrutor, validar se a atividade digitada faz sentido
        const atividadeDigitada = currentInput.trim().toLowerCase();
        console.log(
          "⚠️ Atividade digitada sem instrutor específico:",
          atividadeDigitada
        );

        // Mesmo sem instrutor específico, se temos lista de atividades, validar
        if (instructorActivities && instructorActivities.length > 0) {
          const atividadeEncontrada = instructorActivities.find(
            (atividade) =>
              atividade.atividade.toLowerCase() === atividadeDigitada
          );

          if (atividadeEncontrada) {
            console.log("✅ Atividade válida encontrada:", atividadeEncontrada);
            const aux = {
              ...currentAlunoInfo,
              atividade: atividadeEncontrada.atividade,
            };
            setCurrentAlunoInfo(aux);
            setCurrentStep("cadastro_aluno_observacoes");
            const response = `✅ Atividade: **${atividadeEncontrada.atividade}**\n💰 Valor: ${atividadeEncontrada.valor}\n⏰ Horário: ${atividadeEncontrada.dia_horario}\n📍 Local: ${atividadeEncontrada.localizacao}\n\nAlguma observação? (opcional)`;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setIsLoading(false);
            return;
          } else {
            console.log("❌ Atividade não encontrada na lista");
            let response = `❌ "${currentInput}" não foi encontrada.\n\n📋 Atividades disponíveis:\n`;
            instructorActivities.forEach((atividade, index) => {
              response += `• ${atividade.atividade}\n`;
            });
            response += `\nDigite uma das atividades acima:`;

            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setIsLoading(false);
            return;
          }
        }

        // Caso extremo: não temos dados, aceitar qualquer coisa
        const aux = { ...currentAlunoInfo, atividade: currentInput.trim() };
        setCurrentAlunoInfo(aux);
        setCurrentStep("cadastro_aluno_observacoes");
        const response = "Alguma observação? (opcional)";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
        setIsLoading(false);
        return;
      }
      if (currentStep === "cadastro_aluno_observacoes") {
        // Verificar se o usuário indicou que não tem observações
        const inputLower = currentInput.toLowerCase().trim();
        const observacoes =
          inputLower === "não" ||
          inputLower === "nao" ||
          inputLower === "n" ||
          inputLower === "nenhuma"
            ? ""
            : currentInput.trim();

        const finalAlunoInfo = {
          ...currentAlunoInfo,
          observacoes: observacoes,
        };
        setCurrentAlunoInfo(finalAlunoInfo);

        try {
          console.log("=== SALVANDO ALUNO ===");
          console.log("Dados do aluno:", finalAlunoInfo);
          console.log("ID do instrutor:", currentInstructorId);

          if (!currentInstructorId) {
            throw new Error("ID do instrutor não encontrado");
          }

          // Preparar dados para inserção
          const alunoData = {
            instrutor_id: currentInstructorId,
            nome: finalAlunoInfo.nome?.trim() || "",
            contato: finalAlunoInfo.contato?.trim() || "",
            atividade: finalAlunoInfo.atividade?.trim() || "",
            observacoes: finalAlunoInfo.observacoes?.trim() || "",
          };

          console.log("Dados para inserção:", alunoData);

          const { data: novoAluno, error: alunoError } = await supabase
            .from(TABELA_ALUNOS)
            .insert([alunoData])
            .select()
            .single();

          if (alunoError) {
            console.error("Erro ao cadastrar aluno:", alunoError);

            // Se a tabela não existir, criar uma mensagem específica
            if (alunoError.code === "42P01") {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "⚠️ Sistema de alunos em configuração. O aluno foi registrado temporariamente. Em breve estará disponível!",
                  timestamp: new Date(),
                },
              ]);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "❌ Erro ao cadastrar aluno. Tente novamente em alguns instantes.",
                  timestamp: new Date(),
                },
              ]);
            }
            setCurrentStep("pergunta_aluno");
            setIsLoading(false);
            return;
          }

          console.log("✅ Aluno cadastrado com sucesso:", novoAluno);

          const successMessage = `✅ ${finalAlunoInfo.nome} cadastrado!\n\nCadastrar outro aluno? Digite "sim":`;

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: successMessage,
              timestamp: new Date(),
            },
          ]);

          // Resetar dados do aluno para próximo cadastro
          setCurrentAlunoInfo({
            nome: null,
            contato: null,
            atividade: null,
            observacoes: null,
          });
          setCurrentStep("pergunta_aluno"); // Voltar para perguntar se quer cadastrar outro aluno
        } catch (error) {
          console.error("Erro crítico ao salvar aluno:", error);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "❌ Ocorreu um erro ao cadastrar o aluno. Tente novamente mais tarde.",
              timestamp: new Date(),
            },
          ]);
          setCurrentStep("pergunta_aluno");
        }

        setIsLoading(false);
        return;
      }

      // fluxo normal cadastro instrutor
      const newExtractedInfo = { ...extractedInfo };

      // Extrair informações baseado no passo atual
      if (currentStep === "nome") {
        console.log("🔍 Processando nome no step 'nome':", currentInput);

        // Validar se é um nome válido
        if (!isValidName(currentInput)) {
          const response = "Por favor, digite um nome válido:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        console.log("✅ Nome válido, salvando e indo para atividade");
        newExtractedInfo.nome = currentInput.trim();
        setCurrentStep("atividade");
      } else if (currentStep === "initial") {
        // Verificar se é claramente uma atividade sendo mencionada
        const activityWords = [
          "futebol",
          "volei",
          "surf",
          "yoga",
          "corrida",
          "natação",
          "stand up",
          "sup",
          "paddle",
        ];
        const lowerInput = currentInput.toLowerCase().trim();
        const isActivityMention = activityWords.some(
          (word) =>
            lowerInput === word ||
            lowerInput.includes(`quero ${word}`) ||
            lowerInput.includes(`ofereço ${word}`)
        );

        if (isActivityMention) {
          const response = `${currentInput}? Você quer ser:\n• **instrutor** (ensinar)\n• **aluno** (participar)`;

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // SE for um nome válido, mas não houve indicação clara de instrutor/aluno
        if (
          isValidName(currentInput) &&
          !isAlunoRequest &&
          !isInstrutorRequest
        ) {
          const response = `Olá ${currentInput}! Você quer ser:\n• **instrutor** (oferecer atividades)\n• **aluno** (participar)`;

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          // Salvar o nome temporariamente
          setExtractedInfo((prev) => ({ ...prev, nome: currentInput.trim() }));
          setCurrentStep("escolher_tipo"); // Novo step
          setIsLoading(false);
          return;
        }

        if (!isValidName(currentInput)) {
          const intelligentResponse = await generateAIResponse(
            `Usuário disse "${currentInput}" no início da conversa. Explicar as opções disponíveis.`,
            "resposta_generica",
            currentInput
          );

          const aiMessage: Message = {
            role: "assistant",
            content:
              intelligentResponse ||
              'Digite:\n• **"aluno"** - participar de atividades\n• **"instrutor"** - oferecer atividades\n• Seu **telefone** - consultar dados',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }

        // Se chegou aqui com um nome válido e indicação clara
        newExtractedInfo.nome = currentInput.trim();
        setCurrentStep("atividade");
      } else if (currentStep === "atividade") {
        console.log(
          "🔍 Processando atividade no step 'atividade':",
          currentInput
        );

        // Validar se parece ser uma atividade
        if (
          currentInput.trim().length < 2 ||
          currentInput.trim().length > 100
        ) {
          const response = "Atividade inválida. Tente novamente:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        console.log("✅ Atividade válida, salvando e indo para horário");
        newExtractedInfo.atividade = currentInput.trim();
        setCurrentStep("horario");
      } else if (currentStep === "horario") {
        console.log("🔍 Processando horário no step 'horario':", currentInput);
        newExtractedInfo.dia_horario = currentInput.trim();
        setCurrentStep("valor");
      } else if (currentStep === "valor") {
        console.log("🔍 Processando valor no step 'valor':", currentInput);
        newExtractedInfo.valor = currentInput.trim();
        setCurrentStep("contato");
      } else if (currentStep === "contato") {
        console.log("🔍 Processando contato no step 'contato':", currentInput);
        // Validar se parece ser um contato para instrutor
        const cleanContact = currentInput.replace(/\D/g, "");
        if (cleanContact.length < 8 || cleanContact.length > 15) {
          const response = "Telefone inválido. Digite novamente:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response, timestamp: new Date() },
          ]);
          setIsLoading(false);
          return;
        }

        // VERIFICAR SE O NÚMERO JÁ EXISTE NO BANCO
        try {
          console.log("Verificando se contato já existe:", currentInput);
          const userData = await consultarDados(currentInput);

          if (userData) {
            const response = `✅ Número já cadastrado!\n\n${userData.nome} - ${userData.atividade}\n\nContinue para atualizar ou digite "voltar":`;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: response, timestamp: new Date() },
            ]);
            setCurrentStep("initial");
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Erro ao verificar contato existente:", error);
        }

        // Se chegou aqui, o número não existe - continuar cadastro normal
        newExtractedInfo.contato = currentInput.trim();
        setCurrentStep("localizacao");
      } else if (currentStep === "localizacao") {
        console.log(
          "🔍 Processando localização no step 'localizacao':",
          currentInput
        );
        newExtractedInfo.localizacao = currentInput.trim();
        setCurrentStep("finalizado");
      } else {
        // SITUAÇÃO COMPLETAMENTE INESPERADA - usar IA
        console.log("Step não reconhecido:", currentStep);
        const intelligentResponse = await generateAIResponse(
          `Usuário está em um step desconhecido "${currentStep}" e disse "${currentInput}"`,
          "resposta_generica",
          currentInput
        );
        const finalResponse =
          intelligentResponse ||
          "Ops! Algo deu errado. Vamos recomeçar? Digite seu nome para se cadastrar ou seu telefone para consultar 😊";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: finalResponse, timestamp: new Date() },
        ]);
        setCurrentStep("initial"); // Reset para o início
        setIsLoading(false);
        return;
      }

      setExtractedInfo(newExtractedInfo);

      // Verificar se tem todas as informações
      const hasAllInfo =
        newExtractedInfo.nome &&
        newExtractedInfo.atividade &&
        newExtractedInfo.dia_horario &&
        newExtractedInfo.valor &&
        newExtractedInfo.contato &&
        newExtractedInfo.localizacao;

      if (hasAllInfo) {
        console.log("Tem todas as informações, salvando...");
        // Salvar dados no Supabase
        try {
          const result = await salvarDados(newExtractedInfo);
          setCurrentInstructorId(result.user.id);
          const aiResponse = await generateAIResponse(
            "Cadastro finalizado com sucesso",
            "pergunta_aluno",
            "Instrutor cadastrado"
          );
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: aiResponse, timestamp: new Date() },
          ]);
          setCurrentStep("pergunta_aluno");
          setIsLoading(false);
          return;
        } catch (error) {
          console.error("Erro ao salvar:", error);
          const errorMessage: Message = {
            role: "assistant",
            content:
              "Ops! Houve um problema ao salvar seus dados. Pode tentar novamente?",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsLoading(false);
          return; // Adicionar return para parar o fluxo
        }
      } else {
        // Gerar próxima pergunta com AI
        let stepContext = "";
        let stepType = "";

        switch (currentStep) {
          case "nome":
            stepContext = `Nome do instrutor coletado: ${newExtractedInfo.nome}`;
            stepType = "cadastro_atividade";
            break;
          case "atividade":
            stepContext = `Atividade escolhida: ${newExtractedInfo.atividade}`;
            stepType = "cadastro_horario";
            break;
          case "horario":
            stepContext = `Horário informado: ${newExtractedInfo.dia_horario}`;
            stepType = "cadastro_valor";
            break;
          case "valor":
            stepContext = `Valor informado: ${newExtractedInfo.valor}`;
            stepType = "cadastro_contato";
            break;
          case "contato":
            stepContext = `Contato informado: ${newExtractedInfo.contato}`;
            stepType = "cadastro_localizacao";
            break;
          default:
            stepContext = "Continuar cadastro";
            stepType = "cadastro_generico";
        }

        const aiResponse = await generateAIResponse(
          stepContext,
          stepType,
          currentInput
        );

        // Fallback se IA não responder adequadamente
        const fallbackMessages: { [key: string]: string } = {
          nome: `Olá! 😊 Qual é o seu nome completo?`,
          cadastro_atividade: `Olá ${currentInput}! 😊 Que tipo de atividade você oferece na praia?`,
          cadastro_horario: `Perfeito! 🏖️ Em que dias e horários você oferece ${newExtractedInfo.atividade}?`,
          cadastro_valor: `Ótimo! 💰 Qual é o valor da atividade?`,
          cadastro_contato: `Entendi! 📱 Qual seu número de WhatsApp ou telefone para contato?`,
          cadastro_localizacao: `Perfeito! 📍 Em qual praia você oferece essa atividade?`,
        };

        const finalResponse =
          aiResponse && aiResponse.length > 10 && aiResponse.length < 200
            ? aiResponse
            : fallbackMessages[stepType] ||
              "Continue fornecendo as informações! 😊";

        const assistantMessage: Message = {
          role: "assistant",
          content: finalResponse,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);

      toast({
        title: "Erro de Conexão",
        description:
          "Não foi possível processar sua mensagem. Tente novamente.",
        variant: "destructive",
      });

      const errorMessage: Message = {
        role: "assistant",
        content:
          "Desculpe, houve um problema de conexão. Pode tentar novamente?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickConsult = () => {
    setInput("consultar meus dados");
  };

  const handleQuickCadastro = () => {
    setInput("quero cadastrar minha atividade");
  };

  // Função de teste para verificar dados do banco
  const testDatabase = async () => {
    try {
      console.log("=== TESTE COMPLETO DO BANCO DE DADOS ===");
      console.log("URL do Supabase:", supabaseUrl);
      console.log("Chave Anon:", supabaseAnonKey?.substring(0, 20) + "...");
      console.log("Tabela sendo testada:", TABELA_INSTRUTORES);

      // 1. Testar se consegue acessar o Supabase
      try {
        const { data: healthCheck, error: healthError } = await supabase
          .from("information_schema.tables")
          .select("table_name")
          .limit(1);

        console.log("🔗 Health check Supabase:", { healthCheck, healthError });
      } catch (healthErr) {
        console.error("❌ Erro no health check:", healthErr);
      }

      // 2. Listar todas as tabelas disponíveis
      try {
        const { data: tables, error: tablesError } = await supabase.rpc(
          "get_schema_tables",
          {}
        );
        console.log("📋 Tabelas disponíveis:", tables);
        console.log("❌ Erro ao listar tabelas:", tablesError);
      } catch (tablesErr) {
        console.log("⚠️ Função get_schema_tables não disponível");
      }

      // 3. Testar acesso direto à tabela com diferentes nomes
      const possibleTableNames = [
        "praiativa_usuarios",
        "usuarios",
        "instrutores",
        "user",
        "users",
      ];

      for (const tableName of possibleTableNames) {
        try {
          console.log(`🔍 Testando tabela: ${tableName}`);
          const { data, error, count } = await supabase
            .from(tableName)
            .select("*", { count: "exact" });

          console.log(`✅ Tabela ${tableName}:`, { data, error, count });

          if (data && !error) {
            console.log(
              `🎉 TABELA ENCONTRADA: ${tableName} com ${data.length} registros`
            );
            const message = `🔍 **TESTE DO BANCO - SUCESSO!**\n\n📊 **Tabela encontrada: ${tableName}**\n**Registros: ${
              data.length
            }**\n\n${data
              .map(
                (d, i) =>
                  `${i + 1}. ${d.nome || d.name || "Nome não encontrado"}: ${
                    d.contato ||
                    d.phone ||
                    d.telefone ||
                    "Contato não encontrado"
                  }`
              )
              .join("\n")}`;

            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: message,
                timestamp: new Date(),
              },
            ]);
            return; // Sair da função se encontrou dados
          }
        } catch (tableErr) {
          console.log(`❌ Erro ao acessar ${tableName}:`, tableErr);
        }
      }

      // Se chegou aqui, não encontrou nenhuma tabela
      const message = `❌ **PROBLEMA IDENTIFICADO**\n\nNão consegui acessar nenhuma tabela. Possíveis causas:\n- Permissões RLS ativas\n- Nome da tabela incorreto\n- Chave de acesso incorreta\n- Tabela não existe\n\nVerifique o console para mais detalhes.`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error("❌ Erro no teste completo:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **Erro crítico no teste:** ${err}\n\nVerifique se:\n- O Supabase está configurado corretamente\n- As chaves estão corretas\n- A internet está funcionando`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  // Função para testar especificamente a tabela de alunos
  const testTabelaAlunos = async () => {
    try {
      console.log("=== TESTE ESPECÍFICO DA TABELA DE ALUNOS ===");

      // 1. Verificar se consegue acessar a tabela
      const { data: alunos, error: alunosError } = await supabase
        .from(TABELA_ALUNOS)
        .select("*")
        .limit(10);

      console.log("📊 Dados da tabela de alunos:", alunos);
      console.log("❌ Erro na tabela de alunos:", alunosError);

      if (alunosError) {
        const message = `❌ **TABELA DE ALUNOS - PROBLEMA**\n\n**Erro:** ${alunosError.message}\n**Código:** ${alunosError.code}\n\n**Solução:**\n1. Execute o SQL no Supabase\n2. Verifique as permissões RLS\n3. Confirme se a tabela foi criada`;

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: message,
            timestamp: new Date(),
          },
        ]);
      } else {
        const message = `✅ **TABELA DE ALUNOS - FUNCIONANDO!**\n\n📊 **Registros encontrados:** ${
          alunos?.length || 0
        }\n\n${
          alunos
            ?.map(
              (a, i) => `${i + 1}. ${a.nome} (${a.contato}) - ${a.atividade}`
            )
            .join("\n") || "Nenhum aluno cadastrado"
        }`;

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: message,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("❌ Erro crítico no teste de alunos:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **Erro crítico:** ${error}\n\nA tabela de alunos precisa ser criada no Supabase.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          'Olá! 🏖️ Seja bem-vindo à PraiAtiva!\n\nO que você quer fazer?\n\n🏄‍♂️ Digite "aluno" - para se cadastrar em atividades\n👨‍🏫 Digite "instrutor" - para oferecer atividades\n📱 Digite seu telefone - para consultar dados\n\nEscolha uma opção! 😊',
        timestamp: new Date(),
      },
    ]);
    setCurrentStep("initial");
    setExtractedInfo({
      nome: null,
      atividade: null,
      dia_horario: null,
      valor: null,
      contato: null,
      localizacao: null,
    });
    setCurrentAlunoInfo({
      nome: "",
      contato: "",
      atividade: "",
      observacoes: "",
    });
    setCurrentInstructorId(null);
    setCurrentInstructorData(null);
    setInstructorActivities([]);
  };

  const getStepLabel = (step: ConversationStep): string => {
    const labels = {
      initial: "Nome",
      nome: "Atividade",
      atividade: "Horário",
      horario: "Valor",
      valor: "Contato",
      contato: "Localização",
      localizacao: "Finalizado",
      finalizado: "Completo",
      pergunta_aluno: "Pergunta Aluno",
      cadastro_aluno_nome: "Nome do Aluno",
      cadastro_aluno_contato: "Contato do Aluno",
      cadastro_aluno_atividade: "Atividade do Aluno",
      cadastro_aluno_escolher_atividade: "Escolher Atividade",
      cadastro_aluno_observacoes: "Observações do Aluno",
      aluno_finalizado: "Aluno Cadastrado",
      buscar_instrutor: "Buscar Instrutor",
      login_instrutor: "Login Instrutor",
      escolher_tipo: "Escolher Tipo",
    };
    return labels[step] || step;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Waves className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PraiAtiva
            </h1>
          </div>
          <p className="text-muted-foreground">
            Conectando você ao melhor do esporte e lazer nas praias
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col shadow-lg border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Assistente PraiAtiva
                  <span className="text-xs opacity-75 ml-auto">
                    {currentStep === "finalizado"
                      ? "✅ Completo"
                      : `Coletando: ${getStepLabel(currentStep)}`}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground ml-auto"
                              : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>

                        {message.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-accent-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Processando...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t bg-card">
                  <div className="flex gap-2 mb-2">
                    <Button
                      onClick={handleQuickConsult}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={isLoading}
                    >
                      <Search className="h-3 w-3 mr-1" />
                      Consultar Cadastro
                    </Button>
                    <Button
                      onClick={handleQuickCadastro}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      disabled={isLoading}
                    >
                      ➕ Cadastrar Atividade
                    </Button>
                    <Button
                      onClick={resetChat}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={isLoading}
                    >
                      🔄 Novo Chat
                    </Button>
                    <Button
                      onClick={testDatabase}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                      disabled={isLoading}
                    >
                      🔍 Testar BD
                    </Button>
                    <Button
                      onClick={testTabelaAlunos}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      disabled={isLoading}
                    >
                      👥 Testar Alunos
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Digite seu nome, número ou mensagem..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={isLoading || !input.trim()}
                      size="icon"
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            <Card className="shadow-lg border-accent/20">
              <CardHeader className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground rounded-t-lg">
                <CardTitle className="text-lg">
                  Informações Coletadas
                  {Object.values(extractedInfo).filter(Boolean).length > 0 && (
                    <span className="text-xs ml-2">
                      ({Object.values(extractedInfo).filter(Boolean).length}/6)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {Object.entries({
                  Nome: extractedInfo.nome,
                  Atividade: extractedInfo.atividade,
                  Horário: extractedInfo.dia_horario,
                  Valor: extractedInfo.valor,
                  Contato: extractedInfo.contato,
                  Localização: extractedInfo.localizacao,
                }).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm font-medium text-muted-foreground">
                      {label}:
                    </span>
                    <span
                      className={`text-sm ${
                        value
                          ? "text-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {value
                        ? `✅ ${
                            value.length > 15
                              ? value.substring(0, 15) + "..."
                              : value
                          }`
                        : "Não informado"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Painel de Aluno sendo cadastrado */}
            {currentStep.includes("aluno") &&
              currentStep !== "aluno_finalizado" && (
                <Card className="shadow-lg border-blue-200">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                    <CardTitle className="text-lg">
                      📚 Cadastro de Aluno
                      {Object.values(currentAlunoInfo).filter(Boolean).length >
                        0 && (
                        <span className="text-xs ml-2">
                          (
                          {
                            Object.values(currentAlunoInfo).filter(Boolean)
                              .length
                          }
                          /4)
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {Object.entries({
                      Nome: currentAlunoInfo.nome,
                      Contato: currentAlunoInfo.contato,
                      Atividade: currentAlunoInfo.atividade,
                      Observações: currentAlunoInfo.observacoes,
                    }).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm font-medium text-muted-foreground">
                          {label}:
                        </span>
                        <span
                          className={`text-sm ${
                            value
                              ? "text-blue-600 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {value
                            ? `✅ ${
                                value.length > 15
                                  ? value.substring(0, 15) + "..."
                                  : value
                              }`
                            : label === "Observações"
                            ? "Opcional"
                            : "Não informado"}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

            <Card className="shadow-lg border-muted">
              <CardHeader>
                <CardTitle className="text-lg">Como usar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>📝 **Novo cadastro:** Digite seu nome e siga as perguntas</p>
                <p>📱 **Consultar:** Digite seu número de telefone</p>
                <p>
                  🔄 **Atualizar:** Faça um novo cadastro com o mesmo número
                </p>
                <p>🆕 **Recomeçar:** Use o botão "Novo Chat"</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
