// mapa_regras.js
const REGRAS_PADRAO_MAPA = {
  valor_base: 5.00,
  valor_por_km: 3.50,
  valor_minimo: 10.00,
  valor_por_parada: 0.00,
  percentual_repasse_motorista: 100, // % do valor da corrida que vai para o motorista
  max_paradas: 2,
  tempo_espera_segundos: 180,
  intervalo_radar_ms: 5000,
  raio_alerta_proximidade_metros: 100
};

let regrasAtuaisMapa = { ...REGRAS_PADRAO_MAPA };

function normalizarRegrasMapa(bruto = {}) {
  const num = (val, padrao) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : padrao;
  };

  return {
    valor_base: Math.max(0, num(bruto.valor_base, REGRAS_PADRAO_MAPA.valor_base)),
    valor_por_km: Math.max(0, num(bruto.valor_por_km, REGRAS_PADRAO_MAPA.valor_por_km)),
    valor_minimo: Math.max(0, num(bruto.valor_minimo, REGRAS_PADRAO_MAPA.valor_minimo)),
    valor_por_parada: Math.max(0, num(bruto.valor_por_parada, REGRAS_PADRAO_MAPA.valor_por_parada)),
    percentual_repasse_motorista: Math.min(100, Math.max(0, num(bruto.percentual_repasse_motorista, REGRAS_PADRAO_MAPA.percentual_repasse_motorista))),
    max_paradas: Math.max(0, Math.floor(num(bruto.max_paradas, REGRAS_PADRAO_MAPA.max_paradas))),
    tempo_espera_segundos: Math.max(15, Math.floor(num(bruto.tempo_espera_segundos, REGRAS_PADRAO_MAPA.tempo_espera_segundos))),
    intervalo_radar_ms: Math.max(1500, Math.floor(num(bruto.intervalo_radar_ms, REGRAS_PADRAO_MAPA.intervalo_radar_ms))),
    raio_alerta_proximidade_metros: Math.max(10, num(bruto.raio_alerta_proximidade_metros, REGRAS_PADRAO_MAPA.raio_alerta_proximidade_metros))
  };
}

function obterRegrasMapa() {
  try {
    const salvo = JSON.parse(localStorage.getItem('regras_corrida_mapa') || 'null');
    if (salvo && typeof salvo === 'object') {
      regrasAtuaisMapa = normalizarRegrasMapa({ ...REGRAS_PADRAO_MAPA, ...salvo });
      return regrasAtuaisMapa;
    }
  } catch (e) {}
  return regrasAtuaisMapa;
}

function salvarRegrasMapaLocal(novasRegras) {
  regrasAtuaisMapa = normalizarRegrasMapa({ ...REGRAS_PADRAO_MAPA, ...novasRegras });
  try {
    localStorage.setItem('regras_corrida_mapa', JSON.stringify(regrasAtuaisMapa));
  } catch (e) {}
  return regrasAtuaisMapa;
}

async function carregarRegrasMapa(clienteSupabase) {
  let regras = obterRegrasMapa();

  if (clienteSupabase) {
    try {
      const { data, error } = await clienteSupabase
        .from('configuracoes_corrida')
        .select('*')
        .order('id', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        regras = salvarRegrasMapaLocal(data[0]);
      }
    } catch (e) {}
  }

  return regras;
}

function calcularValorCorrida(distanciaKm, quantidadeParadas = 0, regrasCustom = null) {
  const r = regrasCustom ? normalizarRegrasMapa(regrasCustom) : obterRegrasMapa();
  const km = Math.max(0, Number(distanciaKm) || 0);
  const paradas = Math.max(0, Number(quantidadeParadas) || 0);

  const bruto = r.valor_base + (km * r.valor_por_km) + (paradas * r.valor_por_parada);
  const total = Math.max(r.valor_minimo, bruto);
  const ganhoMotorista = total * (r.percentual_repasse_motorista / 100);
  const taxaPlataforma = Math.max(0, total - ganhoMotorista);

  return {
    total: Number(total.toFixed(2)),
    ganhoMotorista: Number(ganhoMotorista.toFixed(2)),
    taxaPlataforma: Number(taxaPlataforma.toFixed(2)),
    regras: r
  };
}