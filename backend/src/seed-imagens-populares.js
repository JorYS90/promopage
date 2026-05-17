// Lista curada de produtos populares no varejo brasileiro.
// Usado pra popular o BANCO DE IMAGENS POPULARES (imagens-produtos.json) automaticamente
// no startup do servidor. Cada nome aqui é buscado via Yandex e tem suas top imagens
// salvas com peso alto (10), garantindo que apareçam primeiro em buscas similares.
//
// IMPORTANTE: o sistema usa MATCH POR TOKENS, então um seed pra "picanha" também
// vai aparecer quando usuário buscar "Picanha Maturatta", "Picanha Friboi" etc.
// Por isso a lista mistura genéricos (picanha, alcatra) com brand-specific (picanha maturatta)
// pra cobrir tanto buscas amplas quanto específicas.

module.exports = [
  // ===== AÇOUGUE - BOVINOS =====
  { nome: 'picanha', categoria: 'Açougue' },
  { nome: 'picanha bovina', categoria: 'Açougue' },
  { nome: 'picanha maturatta', categoria: 'Açougue' },
  { nome: 'picanha friboi', categoria: 'Açougue' },
  { nome: 'picanha mataboi', categoria: 'Açougue' },
  { nome: 'maminha', categoria: 'Açougue' },
  { nome: 'maminha bovina', categoria: 'Açougue' },
  { nome: 'alcatra', categoria: 'Açougue' },
  { nome: 'alcatra bovina', categoria: 'Açougue' },
  { nome: 'fraldinha bovina', categoria: 'Açougue' },
  { nome: 'contra file', categoria: 'Açougue' },
  { nome: 'contra file bovino', categoria: 'Açougue' },
  { nome: 'contra file maturatta', categoria: 'Açougue' },
  { nome: 'file mignon', categoria: 'Açougue' },
  { nome: 'coxao mole', categoria: 'Açougue' },
  { nome: 'coxao duro', categoria: 'Açougue' },
  { nome: 'patinho', categoria: 'Açougue' },
  { nome: 'patinho moido', categoria: 'Açougue' },
  { nome: 'acem', categoria: 'Açougue' },
  { nome: 'musculo bovino', categoria: 'Açougue' },
  { nome: 'costela bovina', categoria: 'Açougue' },
  { nome: 'costela minga', categoria: 'Açougue' },
  { nome: 'costela pantanal', categoria: 'Açougue' },
  { nome: 'ancho bovino', categoria: 'Açougue' },
  { nome: 'ancho maturatta', categoria: 'Açougue' },
  { nome: 'carne moida', categoria: 'Açougue' },
  { nome: 'carne moida bovina', categoria: 'Açougue' },
  { nome: 'bife bovino', categoria: 'Açougue' },

  // ===== AÇOUGUE - SUÍNOS =====
  { nome: 'pernil suino', categoria: 'Açougue' },
  { nome: 'bisteca suina', categoria: 'Açougue' },
  { nome: 'costela suina', categoria: 'Açougue' },
  { nome: 'lombo suino', categoria: 'Açougue' },
  { nome: 'bacon', categoria: 'Açougue' },
  { nome: 'bacon em cubos', categoria: 'Açougue' },
  { nome: 'bacon manta', categoria: 'Açougue' },
  { nome: 'bacon sadia', categoria: 'Açougue' },
  { nome: 'bacon seara', categoria: 'Açougue' },
  { nome: 'bacon perdigao', categoria: 'Açougue' },
  { nome: 'bacon aurora', categoria: 'Açougue' },

  // ===== AÇOUGUE - AVES =====
  { nome: 'frango inteiro', categoria: 'Açougue' },
  { nome: 'peito de frango', categoria: 'Açougue' },
  { nome: 'file de peito', categoria: 'Açougue' },
  { nome: 'coxa de frango', categoria: 'Açougue' },
  { nome: 'sobrecoxa de frango', categoria: 'Açougue' },
  { nome: 'asa de frango', categoria: 'Açougue' },
  { nome: 'coxinha da asa', categoria: 'Açougue' },
  { nome: 'meio da asa', categoria: 'Açougue' },
  { nome: 'frango sadia', categoria: 'Açougue' },
  { nome: 'frango seara', categoria: 'Açougue' },
  { nome: 'frango perdigao', categoria: 'Açougue' },

  // ===== AÇOUGUE - EMBUTIDOS =====
  { nome: 'linguica calabresa', categoria: 'Açougue' },
  { nome: 'linguica toscana', categoria: 'Açougue' },
  { nome: 'linguica seara', categoria: 'Açougue' },
  { nome: 'linguica sadia', categoria: 'Açougue' },
  { nome: 'salsicha', categoria: 'Açougue' },
  { nome: 'salame', categoria: 'Açougue' },
  { nome: 'presunto', categoria: 'Açougue' },
  { nome: 'mortadela', categoria: 'Açougue' },

  // ===== HORTIFRUTI =====
  { nome: 'banana', categoria: 'Hortifruti' },
  { nome: 'banana prata', categoria: 'Hortifruti' },
  { nome: 'maca', categoria: 'Hortifruti' },
  { nome: 'maca fuji', categoria: 'Hortifruti' },
  { nome: 'laranja', categoria: 'Hortifruti' },
  { nome: 'laranja pera', categoria: 'Hortifruti' },
  { nome: 'mamao', categoria: 'Hortifruti' },
  { nome: 'manga', categoria: 'Hortifruti' },
  { nome: 'uva', categoria: 'Hortifruti' },
  { nome: 'abacaxi', categoria: 'Hortifruti' },
  { nome: 'tomate', categoria: 'Hortifruti' },
  { nome: 'cebola', categoria: 'Hortifruti' },
  { nome: 'alho', categoria: 'Hortifruti' },
  { nome: 'batata', categoria: 'Hortifruti' },
  { nome: 'batata inglesa', categoria: 'Hortifruti' },
  { nome: 'cenoura', categoria: 'Hortifruti' },
  { nome: 'beterraba', categoria: 'Hortifruti' },
  { nome: 'pimentao', categoria: 'Hortifruti' },
  { nome: 'alface', categoria: 'Hortifruti' },
  { nome: 'brocolis', categoria: 'Hortifruti' },
  { nome: 'couve flor', categoria: 'Hortifruti' },

  // ===== MERCEARIA =====
  { nome: 'arroz tio joao', categoria: 'Mercearia' },
  { nome: 'arroz camil', categoria: 'Mercearia' },
  { nome: 'feijao camil', categoria: 'Mercearia' },
  { nome: 'feijao kicaldo', categoria: 'Mercearia' },
  { nome: 'cafe pilao', categoria: 'Mercearia' },
  { nome: 'cafe 3 coracoes', categoria: 'Mercearia' },
  { nome: 'macarrao galo', categoria: 'Mercearia' },
  { nome: 'macarrao adria', categoria: 'Mercearia' },
  { nome: 'oleo de soja liza', categoria: 'Mercearia' },
  { nome: 'oleo de soja soya', categoria: 'Mercearia' },
  { nome: 'acucar uniao', categoria: 'Mercearia' },
  { nome: 'farinha de trigo dona benta', categoria: 'Mercearia' },
  { nome: 'molho de tomate quero', categoria: 'Mercearia' },
  { nome: 'maionese hellmanns', categoria: 'Mercearia' },
  { nome: 'ketchup heinz', categoria: 'Mercearia' },
  { nome: 'sache heinz', categoria: 'Mercearia' },

  // ===== LATICÍNIOS =====
  { nome: 'leite italac', categoria: 'Laticínios' },
  { nome: 'leite piracanjuba', categoria: 'Laticínios' },
  { nome: 'leite ninho', categoria: 'Laticínios' },
  { nome: 'queijo mussarela', categoria: 'Laticínios' },
  { nome: 'queijo prato', categoria: 'Laticínios' },
  { nome: 'iogurte danone', categoria: 'Laticínios' },
  { nome: 'manteiga aviacao', categoria: 'Laticínios' },
  { nome: 'margarina qualy', categoria: 'Laticínios' },
  { nome: 'requeijao catupiry', categoria: 'Laticínios' },

  // ===== BEBIDAS =====
  { nome: 'coca cola', categoria: 'Bebidas' },
  { nome: 'guarana antarctica', categoria: 'Bebidas' },
  { nome: 'sukita', categoria: 'Bebidas' },
  { nome: 'cerveja skol', categoria: 'Bebidas' },
  { nome: 'cerveja brahma', categoria: 'Bebidas' },
  { nome: 'cerveja heineken', categoria: 'Bebidas' },
  { nome: 'cerveja itaipava', categoria: 'Bebidas' },
  { nome: 'agua mineral crystal', categoria: 'Bebidas' },
  { nome: 'suco del valle', categoria: 'Bebidas' },

  // ===== PADARIA =====
  { nome: 'pao frances', categoria: 'Padaria' },
  { nome: 'pao de forma', categoria: 'Padaria' },
  { nome: 'pao de queijo', categoria: 'Padaria' },
];
