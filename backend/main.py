from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.math_model import MicrogridMathModel
import math
import random

app = FastAPI(title="Digital Twin H2 Microgrid", description="API for Green Hydrogen Digital Twin in the Colombian Caribbean")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

math_model = MicrogridMathModel()
total_h2_storage = 0.0

@app.get("/")
def read_root():
    return {"message": "Welcome to the Green Hydrogen Digital Twin API"}

@app.get("/api/status")
def get_status():
    global total_h2_storage
    
    # Simulate current weather conditions in La Guajira
    # La Guajira has high solar irradiation and strong winds
    current_irradiance = random.uniform(800, 1050) # W/m^2
    current_wind_speed = random.uniform(8.0, 12.0) # m/s
    
    # Calculate power generated
    solar_kw = math_model.calculate_solar_power(current_irradiance)
    wind_kw = math_model.calculate_wind_power(current_wind_speed)
    total_power_kw = solar_kw + wind_kw
    
    # Calculate H2 produced in this simulation tick (assume 1 hour tick)
    h2_produced = math_model.calculate_h2_production(total_power_kw, hours=1.0)
    total_h2_storage += h2_produced

    return {
        "environment": {
            "irradiance_w_m2": round(current_irradiance, 2),
            "wind_speed_m_s": round(current_wind_speed, 2)
        },
        "power_generation": {
            "solar_power_kw": round(solar_kw, 2),
            "wind_power_kw": round(wind_kw, 2),
            "total_power_kw": round(total_power_kw, 2)
        },
        "electrolyzer": {
            "status": "Running" if total_power_kw > 0 else "Standby",
            "h2_produced_kg_hr": round(h2_produced, 2)
        },
        "storage": {
            "h2_storage_kg": round(total_h2_storage, 2),
            "fuel_cell_status": "Standby"
        }
    }

def calcular_potencia_eolica(v_viento_ms: float, capacidad_eolica_kw: float) -> float:
    if v_viento_ms < 3.0 or v_viento_ms > 25.0:
        return 0.0
    potencia_generada = capacidad_eolica_kw * ((v_viento_ms / 12.0) ** 3)
    return min(capacidad_eolica_kw, potencia_generada)

@app.get("/simulacion")
def simulacion_gemelo(capacidad_solar_mw: float, capacidad_eolica_mw: float, irradiancia_solar: float = 6.0, velocidad_viento: float = 10.0):
    # Parámetros y constantes de Uribia, La Guajira
    eficiencia_pem_kwh_kg = 52.5  # kWh necesarios para 1 kg de H2
    agua_litros_por_kg_h2 = 9.0   # Litros de agua por kg de H2
    
    # Equivalencia energética y emisiones
    # 1 kg de H2 (LHV ~33.3 kWh) reemplaza ~3.33 litros de diésel (LHV ~10 kWh/L)
    litros_diesel_por_kg_h2 = 3.33
    emisiones_co2_por_litro_diesel = 2.6 # kg de CO2 por litro de diésel
    
    # Cálculos diarios
    capacidad_solar_kw = capacidad_solar_mw * 1000
    energia_diaria_solar_kwh = capacidad_solar_kw * irradiancia_solar
    
    capacidad_eolica_kw = capacidad_eolica_mw * 1000
    kw_eolico_promedio = calcular_potencia_eolica(velocidad_viento, capacidad_eolica_kw)
    energia_diaria_eolica_kwh = kw_eolico_promedio * 24.0
    
    energia_diaria_total_kwh = energia_diaria_solar_kwh + energia_diaria_eolica_kwh
    
    produccion_diaria_h2_kg = energia_diaria_total_kwh / eficiencia_pem_kwh_kg
    agua_diaria_litros = produccion_diaria_h2_kg * agua_litros_por_kg_h2
    
    diesel_desplazado_litros = produccion_diaria_h2_kg * litros_diesel_por_kg_h2
    co2_evitado_kg = diesel_desplazado_litros * emisiones_co2_por_litro_diesel
    
    # Capa Económica
    lcoh_verde_usd_kg = 4.50
    lcoh_gris_usd_kg = 2.10
    
    impuesto_carbono_usd_kg_co2 = 0.10 # $100 USD por tonelada
    co2_evitado_por_kg_h2 = litros_diesel_por_kg_h2 * emisiones_co2_por_litro_diesel
    ahorro_carbono_usd_por_kg_h2 = co2_evitado_por_kg_h2 * impuesto_carbono_usd_kg_co2
    
    diferencia_costo = lcoh_verde_usd_kg - lcoh_gris_usd_kg
    compensacion_porcentaje = (ahorro_carbono_usd_por_kg_h2 / diferencia_costo) * 100
    
    return {
        "parametros_entrada": {
            "capacidad_solar_mw": capacidad_solar_mw,
            "capacidad_eolica_mw": capacidad_eolica_mw,
            "ubicacion": "Uribia, La Guajira"
        },
        "resultados_diarios": {
            "energia_generada_kwh": round(energia_diaria_total_kwh, 2),
            "produccion_h2_kg": round(produccion_diaria_h2_kg, 2),
            "agua_necesaria_litros": round(agua_diaria_litros, 2),
            "diesel_desplazado_litros": round(diesel_desplazado_litros, 2),
            "co2_evitado_kg": round(co2_evitado_kg, 2)
        },
        "economia": {
            "lcoh_verde_usd": lcoh_verde_usd_kg,
            "lcoh_gris_usd": lcoh_gris_usd_kg,
            "compensacion_impuesto_carbono_porcentaje": round(compensacion_porcentaje, 1)
        }
    }

@app.get("/prediccion")
def prediccion_ia(capacidad_solar_mw: float, capacidad_eolica_mw: float, irradiancia_solar: float = 6.0, velocidad_viento: float = 10.0):
    # Genera 24 horas de datos
    datos_hora = []
    
    capacidad_solar_kw = capacidad_solar_mw * 1000
    capacidad_eolica_kw = capacidad_eolica_mw * 1000
    
    for hora in range(24):
        # Máscara solar estricta
        if 6 <= hora <= 18:
            x = (hora - 6) / 12.0 * math.pi
            kw_solar = capacidad_solar_kw * (irradiancia_solar / 6.0) * math.sin(x)
            ruido_solar = random.uniform(-0.05, 0.05) * kw_solar # Ruido proporcional a la curva base
            kw_solar_final = max(0, kw_solar + ruido_solar)
        else:
            kw_solar_final = 0.0
            
        # Lógica de viento suavizada
        if velocidad_viento > 25.0:
            kw_eolico_final = 0.0 # Parada total de seguridad
        else:
            ruido_viento = random.uniform(-1.0, 1.0)
            v_hora = max(0, velocidad_viento + ruido_viento)
            if v_hora < 3.0:
                kw_eolico_final = 0.0
            elif v_hora < 12.0:
                kw_eolico_final = capacidad_eolica_kw * ((v_hora / 12.0) ** 3)
            else:
                ruido_nominal = random.uniform(-0.02, 0.02) * capacidad_eolica_kw
                kw_eolico_final = min(capacidad_eolica_kw, capacidad_eolica_kw + ruido_nominal)
        
        # H2 producido
        prod_solar_h2 = kw_solar_final / 52.5
        prod_eolico_h2 = kw_eolico_final / 52.5
        prod_total_h2 = prod_solar_h2 + prod_eolico_h2
        
        datos_hora.append({
            "hora": f"{hora:02d}:00",
            "solar": round(prod_solar_h2, 2),
            "eolica": round(prod_eolico_h2, 2),
            "h2": round(prod_total_h2, 2)
        })
        
    return {"prediccion_24h": datos_hora}
