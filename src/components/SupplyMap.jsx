import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import { getCoordsForLocation } from '../lib/locationCoords'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function SupplyMap({ listings }) {
  const center = [7.5833, -1.9333]

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '500px' }}>
      <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {listings.map((listing) => {
          const coords = getCoordsForLocation(listing.location)
          return (
            <Marker key={listing.id} position={[coords.lat, coords.lng]}>
              <Popup className="farmer-popup">
                <div className="w-56 sm:w-64">
                  <h3 className="font-bold text-base sm:text-lg text-gray-900">{listing.crop_type}</h3>
                  
                  <div className="mt-2 space-y-1 text-xs sm:text-sm text-gray-700">
                    <p><span className="font-semibold">Location:</span> {listing.location}</p>
                    <p><span className="font-semibold">Available:</span> {listing.quantity}kg</p>
                    <p><span className="font-semibold">Price:</span> ₦{listing.price_per_unit}/kg</p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">{listing.users?.name}</p>
                    {listing.users?.rating && (
                      <p className="text-xs text-yellow-600">Rating: {listing.users.rating.toFixed(1)}</p>
                    )}
                  </div>

                  <Link
                    to={`/product/${listing.id}`}
                    className="mt-3 block w-full bg-white border-2 border-green-600 text-green-600 px-3 py-2 rounded text-center text-xs sm:text-sm font-medium hover:bg-green-50 transition-colors"
                  >
                    View & Order
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export default SupplyMap