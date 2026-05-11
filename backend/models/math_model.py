import math

class MicrogridMathModel:
    def __init__(self):
        # Solar properties
        self.solar_efficiency = 0.20  # 20% efficiency
        self.solar_area = 500  # m^2
        
        # Wind properties
        self.air_density = 1.225  # kg/m^3
        self.turbine_radius = 15  # m
        self.turbine_efficiency = 0.40  # Power coefficient (Cp)
        
        # Electrolyzer properties
        self.electrolyzer_efficiency = 0.65 # 65% efficiency
        self.h2_heating_value = 39.4  # kWh/kg (Lower Heating Value)

    def calculate_solar_power(self, irradiance: float) -> float:
        """
        Calculate solar power in kW.
        irradiance: W/m^2 (e.g. 1000 for peak sun)
        """
        # Power (W) = Irradiance * Area * Efficiency
        power_w = irradiance * self.solar_area * self.solar_efficiency
        return power_w / 1000.0  # Convert to kW

    def calculate_wind_power(self, wind_speed: float) -> float:
        """
        Calculate wind power in kW.
        wind_speed: m/s
        """
        area = math.pi * (self.turbine_radius ** 2)
        # Power (W) = 0.5 * density * area * velocity^3 * Cp
        power_w = 0.5 * self.air_density * area * (wind_speed ** 3) * self.turbine_efficiency
        return power_w / 1000.0  # Convert to kW

    def calculate_h2_production(self, power_kw: float, hours: float = 1.0) -> float:
        """
        Calculate Hydrogen production in kg based on available power.
        power_kw: Total renewable power allocated to electrolyzer.
        """
        energy_kwh = power_kw * hours
        # H2 (kg) = (Energy * Efficiency) / Heating Value
        h2_kg = (energy_kwh * self.electrolyzer_efficiency) / self.h2_heating_value
        return h2_kg
