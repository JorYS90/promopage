// Validação de CPF/CNPJ e telefone brasileiro. Usado no signup pra garantir
// que os dados cadastrais obrigatórios sejam VÁLIDOS (com dígito verificador),
// não apenas preenchidos. Espelhado no frontend (frontend/src/auth/documento.js).

function soDigitos(s) {
  return String(s || '').replace(/\D/g, '');
}

function validarCPF(valor) {
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

function validarCNPJ(valor) {
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

// CPF (11 dígitos) OU CNPJ (14 dígitos), ambos com dígito verificador válido.
function validarDocumento(valor) {
  const d = soDigitos(valor);
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}

// Telefone BR: 10 dígitos (fixo c/ DDD) ou 11 (celular c/ DDD).
function validarTelefone(valor) {
  const d = soDigitos(valor);
  return d.length === 10 || d.length === 11;
}

module.exports = { soDigitos, validarCPF, validarCNPJ, validarDocumento, validarTelefone };
