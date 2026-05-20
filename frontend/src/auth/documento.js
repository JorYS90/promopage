// Validação + máscara de CPF/CNPJ e telefone BR para o formulário de cadastro.
// Espelha a validação do backend (backend/src/lib/documento.js) pra dar feedback
// instantâneo. O backend continua sendo a fonte da verdade.

export function soDigitos(s) {
  return String(s || '').replace(/\D/g, '');
}

export function validarCPF(valor) {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

export function validarCNPJ(valor) {
  const cnpj = soDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digito = (base) => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digito(cnpj.slice(0, 12));
  if (d1 !== parseInt(cnpj[12], 10)) return false;
  const d2 = digito(cnpj.slice(0, 13));
  return d2 === parseInt(cnpj[13], 10);
}

export function validarDocumento(valor) {
  const d = soDigitos(valor);
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

export function validarTelefone(valor) {
  const d = soDigitos(valor);
  return d.length === 10 || d.length === 11;
}

// Máscara progressiva de telefone: (XX) XXXX-XXXX (fixo) ou (XX) XXXXX-XXXX (cel)
export function mascararTelefone(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Máscara progressiva: CPF 000.000.000-00 (até 11) ou CNPJ 00.000.000/0000-00.
export function mascararDocumento(valor) {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    let out = d.slice(0, 3);
    if (d.length > 3) out += '.' + d.slice(3, 6);
    if (d.length > 6) out += '.' + d.slice(6, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }
  let out = d.slice(0, 2);
  out += '.' + d.slice(2, 5);
  out += '.' + d.slice(5, 8);
  out += '/' + d.slice(8, 12);
  if (d.length > 12) out += '-' + d.slice(12, 14);
  return out;
}
