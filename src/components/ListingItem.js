import { Link } from "react-router-dom";
import { ReactComponent as DeleteIcon } from "../assets/svg/deleteIcon.svg";
import { ReactComponent as EditIcon } from "../assets/svg/editIcon.svg";
import bedIcon from "../assets/svg/bedIcon.svg";
import baththubIcon from "../assets/svg/bathtubIcon.svg";
import { priceFormat } from "../assets/helper-functions/priceFormat";

function ListingItem({ listing, id, onDelete, onEdit }) {
  const displayIcons = (number) => {
    let iconCounter = [];

    for (let i = 1; i <= number; i++) {
      iconCounter.push(i);
    }

    return iconCounter;
  };
  return (
    <li className="categoryListing">
      <Link
        to={`/category/${listing.type}/${id}`}
        className="categoryListingLink"
      >
        <img
          src={listing.imgUrls[0]}
          alt={listing.name}
          className="categoryListingImg"
        />
        <div className="categoryListingDetails">
          <p className="categoryListingLocation">{listing.location}</p>
          <p className="categoryListingName">{listing.name}</p>
          <p className="categoryListingPrice">
            €
            {listing.offer
              ? priceFormat(listing.discountedPrice)
              : priceFormat(listing.regularPrice)}
            {listing.type === "rent" && " per month"}
          </p>
          <div className="categoryListingInfoDiv">
            <div>
              {displayIcons(listing.bedrooms).map((number, i) => (
                <img src={bedIcon} alt="bed" key={i} />
              ))}
            </div>
            <p className="categoryListingInfoText">
              {listing.bedrooms > 1
                ? `${listing.bedrooms} Bedrooms`
                : "1 Bedroom"}
            </p>
          </div>
          <div className="categoryListingInfoDiv">
            <div>
              {displayIcons(listing.bathrooms).map((number, i) => (
                <img src={baththubIcon} alt="bed" key={i} />
              ))}
            </div>
            <p className="categoryListingInfoText">
              {listing.bathrooms > 1
                ? `${listing.bedrooms} Bathrooms`
                : "1 Bathroom"}
            </p>
          </div>
        </div>
      </Link>
      {onEdit && (
        <EditIcon className="editIcon" onClick={() => onEdit(listing.id)} />
      )}
      {onDelete && (
        <DeleteIcon
          className="removeIcon"
          fill="rgb(231,76,60)"
          onClick={() => onDelete(listing.id, listing.name)}
        />
      )}
    </li>
  );
}

export default ListingItem;
