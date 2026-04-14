let service: google.maps.DirectionsService | null = null;

function getService(): google.maps.DirectionsService {
  if (!service && window.google?.maps) {
    service = new google.maps.DirectionsService();
  }
  if (!service) {
    throw new Error("Google Maps not loaded yet. Please wait a moment and try again.");
  }
  return service;
}

export async function searchRoutes(
  origin: string,
  destination: string
): Promise<google.maps.DirectionsResult> {
  const svc = getService();
  return svc.route({
    origin,
    destination,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true,
    unitSystem: google.maps.UnitSystem.IMPERIAL,
  });
}
