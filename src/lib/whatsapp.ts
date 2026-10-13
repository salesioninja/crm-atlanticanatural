export const formatWhatsAppLink = (phone: string, message: string) => {
  // Remove non-numeric characters for the link
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
};

export const MESSAGES = {
  REMINDER: (clientName: string, treatment: string, time: string) => 
    `Olá ${clientName}! ✨ Passando para confirmar seu procedimento de ${treatment} agendado para amanhã, às ${time}. Podemos confirmar?`,
  
  FOLLOW_UP: (clientName: string, treatment: string) => 
    `Olá ${clientName}! 👋 Como está sua pele após o procedimento de ${treatment}? Gostaria de agendar seu retorno para manutenção?`,
    
  WELCOME: (clientName: string) => 
    `Olá ${clientName}! Seja bem-vinda à nossa clínica. É um prazer ter você conosco! 🌸`
};
