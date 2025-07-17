import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Configuração do cliente Supabase
const supabaseUrl = "https://nzvdcpzndkbjmojmqskg.supabase.co";
const supabaseKey =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmRjcHpuZGtiam1vam1xc2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1Mzk5ODcsImV4cCI6MjA2ODExNTk4N30.LzTE8DnYQRg-t7ALo9FcgqBjP_u4sVAuNtAgTYniyUo";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message,
      conversationHistory,
      extractedInfo: clientExtractedInfo,
    } = await req.json();

    console.log("Mensagem recebida:", message);

    // Primeiro, verificar se é uma consulta de dados existentes
    const isConsultation = await checkIfConsultation(message);

    if (isConsultation.isConsultation) {
      const userData = await consultUserData(isConsultation.contact);
      if (userData) {
        return new Response(
          JSON.stringify({
            response: formatUserDataResponse(userData),
            isConsultation: true,
            userData,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            response:
              "Não encontrei nenhum cadastro com esse contato. Gostaria de fazer um novo cadastro? 🏖️",
            isConsultation: true,
            userData: null,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Se não é consulta, processar normalmente
    const extractedInfo = clientExtractedInfo || {
      nome: null,
      atividade: null,
      dia_horario: null,
      valor: null,
      contato: null,
      localizacao: null,
    };

    // Verificar se temos todas as informações necessárias
    const hasAllInfo =
      extractedInfo.nome &&
      extractedInfo.atividade &&
      extractedInfo.dia_horario &&
      extractedInfo.valor &&
      extractedInfo.contato &&
      extractedInfo.localizacao;

    let aiResponse = "";
    let userRegistered = false;
    let userData = null;

    if (hasAllInfo) {
      console.log("Todas as informações coletadas, verificando usuário...");

      // Verificar se usuário já existe pelo contato
      const { data: existingUser, error } = await supabase
        .from("dbpraiativa2")
        .select("*")
        .eq("contato", extractedInfo.contato)
        .single();

      if (existingUser && !error) {
        console.log("Usuário encontrado:", existingUser);
        userRegistered = true;
        userData = existingUser;

        // Atualizar dados existentes
        const { data: updatedUser, error: updateError } = await supabase
          .from("dbpraiativa2")
          .update({
            nome: extractedInfo.nome,
            atividade: extractedInfo.atividade,
            dia_horario: extractedInfo.dia_horario,
            valor: extractedInfo.valor,
            localizacao: extractedInfo.localizacao,
          })
          .eq("contato", extractedInfo.contato)
          .select()
          .single();

        if (updateError) {
          aiResponse =
            "Encontrei seu cadastro, mas houve um problema ao atualizar. Pode tentar novamente?";
        } else {
          aiResponse =
            `Opa ${extractedInfo.nome}! Atualizei seu cadastro! 🎉\n\n` +
            `📱 Atividade: ${updatedUser.atividade}\n` +
            `⏰ Horário: ${updatedUser.dia_horario}\n` +
            `💰 Valor: ${updatedUser.valor}\n` +
            `📍 Localização: ${updatedUser.localizacao}\n` +
            `📞 Contato: ${updatedUser.contato}\n\n` +
            `Para consultar seus dados novamente, é só me enviar seu número de contato! 📱`;
        }
      } else {
        console.log("Usuário não encontrado, cadastrando...");

        // Cadastrar novo usuário
        const { data: newUser, error: insertError } = await supabase
          .from("dbpraiativa2")
          .insert([
            {
              nome: extractedInfo.nome,
              atividade: extractedInfo.atividade,
              dia_horario: extractedInfo.dia_horario,
              valor: extractedInfo.valor,
              contato: extractedInfo.contato,
              localizacao: extractedInfo.localizacao,
            },
          ])
          .select()
          .single();

        if (insertError) {
          console.error("Erro ao cadastrar:", insertError);
          aiResponse =
            "Ops! Houve um problema ao cadastrar seus dados. Pode tentar novamente?";
        } else {
          console.log("Usuário cadastrado com sucesso:", newUser);
          userData = newUser;
          aiResponse =
            `Perfeito ${extractedInfo.nome}! 🎉 Seus dados foram cadastrados com sucesso na PraiAtiva!\n\n` +
            `📱 Atividade: ${newUser.atividade}\n` +
            `⏰ Horário: ${newUser.dia_horario}\n` +
            `💰 Valor: ${newUser.valor}\n` +
            `📍 Localização: ${newUser.localizacao}\n` +
            `📞 Contato: ${newUser.contato}\n\n` +
            `Agora você faz parte da comunidade PraiAtiva! 🏖️\n\n` +
            `💡 Dica: Para consultar seus dados futuramente, é só me enviar seu número de contato!`;
        }
      }
    } else {
      // Continuar coletando informações
      aiResponse =
        "Continue fornecendo as informações para completar seu cadastro! 😊";
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        extractedInfo,
        hasAllInfo,
        userRegistered,
        userData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no chatbot:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        response: "Desculpe, houve um problema técnico. Pode tentar novamente?",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Função para verificar se é uma consulta
async function checkIfConsultation(message: string) {
  const lowerMessage = message.toLowerCase();

  // Palavras-chave que indicam consulta
  const consultationKeywords = [
    "consultar",
    "consulta",
    "ver meu cadastro",
    "meus dados",
    "meu cadastro",
    "minhas informações",
    "buscar",
    "procurar",
  ];

  const hasConsultationKeyword = consultationKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  // Verificar se tem número de telefone
  const phoneRegex = /(\(?\d{2}\)?\s?\d{4,5}-?\d{4}|\d{10,11})/;
  const hasPhone = phoneRegex.test(message);

  // Se tem palavra-chave de consulta OU se enviou apenas um número
  if (hasConsultationKeyword || (hasPhone && message.trim().length <= 20)) {
    const phoneMatch = message.match(phoneRegex);
    return {
      isConsultation: true,
      contact: phoneMatch ? phoneMatch[0] : null,
    };
  }

  return { isConsultation: false, contact: null };
}

// Função para consultar dados do usuário
async function consultUserData(contact: string) {
  if (!contact) return null;

  try {
    // Limpar o número para busca (remover caracteres especiais)
    const cleanContact = contact.replace(/\D/g, "");

    const { data, error } = await supabase
      .from("dbpraiativa2")
      .select("*")
      .or(`contato.ilike.%${contact}%,contato.ilike.%${cleanContact}%`)
      .single();

    if (error) {
      console.log("Usuário não encontrado:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Erro ao consultar dados:", error);
    return null;
  }
}

// Função para formatar resposta com dados do usuário
function formatUserDataResponse(userData: any): string {
  return (
    `Encontrei seu cadastro! 🎉\n\n` +
    `👤 Nome: ${userData.nome}\n` +
    `🏖️ Atividade: ${userData.atividade}\n` +
    `⏰ Horário: ${userData.dia_horario}\n` +
    `💰 Valor: ${userData.valor}\n` +
    `📍 Localização: ${userData.localizacao}\n` +
    `📞 Contato: ${userData.contato}\n\n` +
    `Precisa atualizar alguma informação? É só me falar! 😊`
  );
}
