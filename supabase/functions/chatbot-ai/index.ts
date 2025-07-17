import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuração do cliente Supabase
const supabaseUrl = "https://nzvdcpzndkbjmojmqskg.supabase.co";
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmRjcHpuZGtiam1vam1xc2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1Mzk5ODcsImV4cCI6MjA2ODExNTk4N30.LzTE8DnYQRg-t7ALo9FcgqBjP_u4sVAuNtAgTYniyUo";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();

    console.log('Mensagem recebida:', message);
    console.log('Histórico:', conversationHistory);

    // Extrair informações usando IA
    const extractedInfo = await extractInformation(message, conversationHistory);
    console.log('Informações extraídas:', extractedInfo);

    // Verificar se temos todas as informações necessárias
    const hasAllInfo = extractedInfo.atividade && extractedInfo.dia_horario && 
                      extractedInfo.valor && extractedInfo.contato && extractedInfo.localizacao;

    let aiResponse = '';
    let userRegistered = false;
    let userData = null;

    if (hasAllInfo) {
      console.log('Todas as informações coletadas, verificando usuário...');
      
      // Verificar se usuário já existe
      const { data: existingUser, error } = await supabase
        .from('dbpraiativa2')
        .select('*')
        .eq('contato', extractedInfo.contato)
        .single();

      if (existingUser && !error) {
        console.log('Usuário encontrado:', existingUser);
        userRegistered = true;
        userData = existingUser;
        aiResponse = `Opa! Vi que você já está cadastrado conosco! 🏖️\n\n` +
                    `Aqui estão seus dados:\n` +
                    `📱 Atividade: ${existingUser.atividade}\n` +
                    `⏰ Horário: ${existingUser.dia_horario}\n` +
                    `💰 Valor: ${existingUser.valor}\n` +
                    `📍 Localização: ${existingUser.localizacao}\n` +
                    `📞 Contato: ${existingUser.contato}\n\n` +
                    `Se quiser atualizar alguma informação, é só me falar!`;
      } else {
        console.log('Usuário não encontrado, cadastrando...');
        
        // Cadastrar novo usuário
        const { data: newUser, error: insertError } = await supabase
          .from('dbpraiativa2')
          .insert([{
            atividade: extractedInfo.atividade,
            dia_horario: extractedInfo.dia_horario,
            valor: extractedInfo.valor,
            contato: extractedInfo.contato,
            localizacao: extractedInfo.localizacao
          }])
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao cadastrar:', insertError);
          aiResponse = 'Ops! Houve um problema ao cadastrar seus dados. Pode tentar novamente?';
        } else {
          console.log('Usuário cadastrado com sucesso:', newUser);
          userData = newUser;
          aiResponse = `Perfeito! 🎉 Seus dados foram cadastrados com sucesso na PraiAtiva!\n\n` +
                      `📱 Atividade: ${newUser.atividade}\n` +
                      `⏰ Horário: ${newUser.dia_horario}\n` +
                      `💰 Valor: ${newUser.valor}\n` +
                      `📍 Localização: ${newUser.localizacao}\n` +
                      `📞 Contato: ${newUser.contato}\n\n` +
                      `Agora você faz parte da comunidade PraiAtiva! 🏖️ Conectando você ao melhor do esporte e lazer nas praias!`;
        }
      }
    } else {
      // Gerar resposta da IA para coletar mais informações
      aiResponse = await generateAIResponse(message, conversationHistory, extractedInfo);
    }

    return new Response(JSON.stringify({ 
      response: aiResponse,
      extractedInfo,
      hasAllInfo,
      userRegistered,
      userData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no chatbot:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      response: 'Desculpe, houve um problema técnico. Pode tentar novamente?' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractInformation(message: string, history: any[]) {
  const prompt = `
Você é um assistente da PraiAtiva que extrai informações de conversas para cadastro de instrutores de atividades de praia.

INFORMAÇÕES NECESSÁRIAS:
- atividade: tipo de atividade (surf, vôlei, futevôlei, corrida, etc.)
- dia_horario: dias da semana e horários disponíveis
- valor: preço das aulas/atividades
- contato: número de telefone ou WhatsApp
- localizacao: praia ou local onde oferece a atividade

INSTRUÇÕES:
1. Analise a conversa completa e extraia as informações mencionadas
2. Retorne APENAS um JSON válido
3. Use null para informações não mencionadas
4. Para contato, extraia números de telefone no formato brasileiro

CONVERSA ATUAL:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}
NOVA MENSAGEM: ${message}

Retorne apenas o JSON:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    const data = await response.json();
    const extracted = data.choices[0].message.content.trim();
    
    // Tentar fazer parse do JSON
    try {
      return JSON.parse(extracted);
    } catch {
      // Se não conseguir fazer parse, retornar objeto vazio
      return {
        atividade: null,
        dia_horario: null,
        valor: null,
        contato: null,
        localizacao: null
      };
    }
  } catch (error) {
    console.error('Erro ao extrair informações:', error);
    return {
      atividade: null,
      dia_horario: null,
      valor: null,
      contato: null,
      localizacao: null
    };
  }
}

async function generateAIResponse(message: string, history: any[], extractedInfo: any) {
  const missingInfo = [];
  if (!extractedInfo.atividade) missingInfo.push('tipo de atividade');
  if (!extractedInfo.dia_horario) missingInfo.push('dias e horários disponíveis');
  if (!extractedInfo.valor) missingInfo.push('valor das aulas');
  if (!extractedInfo.contato) missingInfo.push('número de telefone/WhatsApp');
  if (!extractedInfo.localizacao) missingInfo.push('localização (praia)');

  const prompt = `
Você é um assistente amigável da PraiAtiva, plataforma que conecta instrutores de atividades de praia.

PERSONALIDADE:
- Descontraído e amigável
- Use emojis relacionados a praia e esportes
- Mantenha o tom brasileiro informal
- Seja objetivo mas simpático

INFORMAÇÕES JÁ COLETADAS:
${Object.entries(extractedInfo).map(([key, value]) => 
  value ? `- ${key}: ${value}` : ''
).filter(Boolean).join('\n')}

AINDA PRECISAMOS DE:
${missingInfo.join(', ')}

CONTEXTO DA CONVERSA:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}

MENSAGEM ATUAL: ${message}

INSTRUÇÕES:
1. Responda à mensagem atual de forma natural
2. Se ainda falta informação, pergunte sobre UMA informação por vez
3. Use perguntas abertas e naturais
4. Mantenha o foco no cadastro de instrutor/atividade
5. Máximo 2-3 frases por resposta

Responda:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Erro ao gerar resposta:', error);
    return 'Desculpe, houve um problema. Pode me contar qual atividade você oferece na praia?';
  }
}