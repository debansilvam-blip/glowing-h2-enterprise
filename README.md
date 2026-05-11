# Gemelo Digital de Micro-red de Hidrógeno Verde

## Descripción
Este proyecto es un Gemelo Digital para una micro-red de Hidrógeno Verde diseñada específicamente para las condiciones climáticas del **Caribe Colombiano**. El sistema utiliza un backend en Python (FastAPI) con modelos de inteligencia artificial (LSTM) y un frontend en React (Vite) para visualización en 3D.

## Flujo de Energía del Sistema

El modelo representa el siguiente ciclo de generación y consumo:

1. **Generación Renovable**: Paneles Solares y Turbinas Eólicas generan electricidad basados en datos climáticos del Caribe Colombiano (alta radiación solar y vientos alisios constantes).
2. **Electrolizador**: La energía generada (o el excedente) alimenta el electrolizador, que separa el agua en Hidrógeno (H2) y Oxígeno (O2).
3. **Almacenamiento de H2**: El hidrógeno verde producido se comprime y almacena en tanques de alta presión.
4. **Celda de Combustible (Fuel Cell)**: Cuando la generación renovable no es suficiente para la demanda, el hidrógeno almacenado se utiliza en una celda de combustible para generar electricidad de respaldo.
5. **Consumo/Red (Grid)**: La electricidad producida por fuentes renovables y la celda de combustible es consumida por la micro-red o inyectada a la red principal nacional.

## Estructura del Proyecto

- `/backend`: API RESTful usando FastAPI y modelos de Machine Learning (LSTM).
- `/frontend`: Dashboard en React (Vite) para visualización y monitoreo del gemelo.
- `/data`: Datasets de radiación solar, viento, temperatura, etc., específicos de Colombia.

## Instalación

### Requisitos Previos
- Python 3.9+ 
- Node.js y npm instalados

### Backend
*(Nota: Debes crear el entorno virtual manualmente ya que las herramientas globales de Python no estaban en el PATH)*
```bash
cd backend
python -m venv .venv
# Activar entorno:
# En Windows: .venv\Scripts\activate
# En Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
