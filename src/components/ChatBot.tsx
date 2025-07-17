import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Waves, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@supabase/supabase-js";

// Configuração do Supabase
const supabaseUrl = "https://nzvdcpzndkbjmojmqskg.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmRjcHpuZGtiam1vam1xc2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1Mzk5ODcsImV4cCI6MjA2ODExNTk4N30.LzTE8DnYQRg-t7ALo9FcgqBjP_u4sVAuNtAgTYniyUo";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Nome da nova tabela
const TABELA_NOME = "praiativa_usuarios";

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

type ConversationStep =
  | "initial"
  | "nome"
  | "atividade"
  | "horario"
  | "valor"
  | "contato"
  | "localizacao"
  | "finalizado";

export const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá! 🏖️ Seja bem-vindo à PraiAtiva!\n\n💡 **Você pode:**\n- Fazer um novo cadastro de atividade\n- Consultar seu cadastro enviando seu número\n\nComo posso ajudá-lo hoje? Digite seu nome para começar ou seu número para consultar! 📱",
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
  const { toast } = useToast();

  // Função para detectar se é um número de telefone
  const isPhoneNumber = (input: string): boolean => {
    const phoneRegex = /(\(?\d{2}\)?\s?\d{4,5}-?\d{4}|\d{10,11})/;
    return phoneRegex.test(input) && input.trim().length <= 20;
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

  // Função para consultar dados no Supabase
  const consultarDados = async (contact: string) => {
    try {
      console.log("Consultando dados para:", contact);
      const cleanContact = contact.replace(/\D/g, "");

      const { data, error } = await supabase
        .from(TABELA_NOME) // Usando nova tabela
        .select("*")
        .or(`contato.ilike.%${contact}%,contato.ilike.%${cleanContact}%`)
        .single();

      if (error) {
        console.log("Erro na consulta:", error);
        return null;
      }

      console.log("Dados encontrados:", data);
      return data;
    } catch (error) {
      console.error("Erro ao consultar dados:", error);
      return null;
    }
  };

  // Função para salvar/atualizar dados no Supabase
  const salvarDados = async (info: ExtractedInfo) => {
    try {
      console.log("=== INICIANDO SALVAMENTO ===");
      console.log("Tabela sendo usada:", TABELA_NOME);
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
        .from(TABELA_NOME) // Usando nova tabela
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
          .from(TABELA_NOME) // Usando nova tabela
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
          .from(TABELA_NOME) // Usando nova tabela
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      // Aguardar um pouco para simular processamento
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verificar se é consulta
      const isConsultation =
        isPhoneNumber(currentInput) ||
        currentInput.toLowerCase().includes("consultar") ||
        currentInput.toLowerCase().includes("meus dados");

      if (isConsultation) {
        console.log("É uma consulta");
        // Consultar dados existentes
        const userData = await consultarDados(currentInput);

        let responseText = "";

        if (userData) {
          responseText =
            `Encontrei seu cadastro! 🎉\n\n` +
            `👤 Nome: ${userData.nome}\n` +
            `🏖️ Atividade: ${userData.atividade}\n` +
            `⏰ Horário: ${userData.dia_horario}\n` +
            `💰 Valor: ${userData.valor}\n` +
            `📍 Localização: ${userData.localizacao}\n` +
            `📞 Contato: ${userData.contato}\n\n` +
            `Precisa atualizar alguma informação? É só me falar! 😊`;

          // Atualizar painel
          setExtractedInfo({
            nome: userData.nome,
            atividade: userData.atividade,
            dia_horario: userData.dia_horario,
            valor: userData.valor,
            contato: userData.contato,
            localizacao: userData.localizacao,
          });
          setCurrentStep("finalizado");

          toast({
            title: "Cadastro Encontrado! 🎉",
            description: `Dados de ${userData.nome} carregados com sucesso!`,
          });
        } else {
          responseText =
            "Não encontrei nenhum cadastro com esse contato. Gostaria de fazer um novo cadastro? 🏖️";
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: responseText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        console.log("Fluxo normal de cadastro");
        // Fluxo normal de cadastro
        const newExtractedInfo = { ...extractedInfo };

        // Extrair informações baseado no passo atual
        if (currentStep === "initial") {
          if (!isValidName(currentInput)) {
            const assistantMessage: Message = {
              role: "assistant",
              content:
                "Desculpe, mas preciso do seu nome próprio para prosseguir. 😊 Por favor, me diga apenas seu primeiro nome ou nome completo. Exemplo: João ou Maria Silva.",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setIsLoading(false);
            return;
          }
          newExtractedInfo.nome = currentInput.trim();
          setCurrentStep("nome");
        } else if (currentStep === "nome") {
          newExtractedInfo.atividade = currentInput.trim();
          setCurrentStep("atividade");
        } else if (currentStep === "atividade") {
          newExtractedInfo.dia_horario = currentInput.trim();
          setCurrentStep("horario");
        } else if (currentStep === "horario") {
          newExtractedInfo.valor = currentInput.trim();
          setCurrentStep("valor");
        } else if (currentStep === "valor") {
          newExtractedInfo.contato = currentInput.trim();
          setCurrentStep("contato");
        } else if (currentStep === "contato") {
          newExtractedInfo.localizacao = currentInput.trim();
          setCurrentStep("finalizado");
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

            const responseText = result.isUpdate
              ? `Opa ${newExtractedInfo.nome}! Atualizei seu cadastro! 🎉\n\n` +
                `📱 Atividade: ${result.user.atividade}\n` +
                `⏰ Horário: ${result.user.dia_horario}\n` +
                `💰 Valor: ${result.user.valor}\n` +
                `📍 Localização: ${result.user.localizacao}\n` +
                `📞 Contato: ${result.user.contato}\n\n` +
                `Para consultar seus dados novamente, é só me enviar seu número de contato! 📱`
              : `Perfeito ${newExtractedInfo.nome}! 🎉 Seus dados foram cadastrados com sucesso na PraiAtiva!\n\n` +
                `📱 Atividade: ${result.user.atividade}\n` +
                `⏰ Horário: ${result.user.dia_horario}\n` +
                `💰 Valor: ${result.user.valor}\n` +
                `📍 Localização: ${result.user.localizacao}\n` +
                `📞 Contato: ${result.user.contato}\n\n` +
                `Agora você faz parte da comunidade PraiAtiva! 🏖️\n\n` +
                `💡 Dica: Para consultar seus dados futuramente, é só me enviar seu número de contato!`;

            const assistantMessage: Message = {
              role: "assistant",
              content: responseText,
              timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            toast({
              title: result.isUpdate
                ? "Cadastro Atualizado! 🎉"
                : "Cadastro Realizado! 🎉",
              description: `Bem-vindo à comunidade PraiAtiva, ${newExtractedInfo.nome}!`,
            });
          } catch (error) {
            console.error("Erro ao salvar:", error);
            const errorMessage: Message = {
              role: "assistant",
              content:
                "Ops! Houve um problema ao salvar seus dados. Pode tentar novamente?",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
        } else {
          // Gerar próxima pergunta
          const nextQuestions: {
            [key in ConversationStep]?: string;
          } = {
            initial: `Olá ${currentInput}! 😊 Que tipo de atividade você oferece na praia?`,
            nome: `Perfeito! 🏖️ Em que dias e horários você oferece ${currentInput}?`,
            atividade: `Ótimo! 💰 Qual é o valor da atividade?`,
            horario: `Entendi! 📱 Qual seu número de WhatsApp ou telefone para contato?`,
            valor: `Perfeito! 📍 Em qual praia você oferece essa atividade?`,
          };

          const assistantMessage: Message = {
            role: "assistant",
            content:
              nextQuestions[currentStep] ||
              "Continue fornecendo as informações! 😊",
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);
        }
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

  const resetChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Olá! 🏖️ Seja bem-vindo à PraiAtiva!\n\n💡 **Você pode:**\n- Fazer um novo cadastro de atividade\n- Consultar seu cadastro enviando seu número\n\nComo posso ajudá-lo hoje? Digite seu nome para começar ou seu número para consultar! 📱",
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
                      onClick={resetChat}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={isLoading}
                    >
                      🔄 Novo Chat
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
