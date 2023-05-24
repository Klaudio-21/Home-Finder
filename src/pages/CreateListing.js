import { useState, useEffect, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.config";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import { toast } from "react-toastify";

function CreateListing() {
  //eslint-disable-next-line
  //If the client wants the person to type the address
  const [geolocationEnable, setGeolocationEnable] = useState(true);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: "rent",
    name: "",
    bedrooms: 1,
    bathrooms: 1,
    parking: false,
    furnished: true,
    address: "",
    offer: true,
    regularPrice: 0,
    discountedPrice: 0,
    images: {},
    latitude: 0,
    longitude: 0,
  });

  const {
    type,
    name,
    bedrooms,
    bathrooms,
    parking,
    furnished,
    address,
    offer,
    regularPrice,
    discountedPrice,
    images,
    latitude,
    longitude,
  } = formData;

  const auth = getAuth();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  useEffect(() => {
    if (isMounted) {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setFormData({ ...formData, userRef: user.uid });
        } else {
          navigate("/sign-in");
        }
      });
    }
    return () => {
      isMounted.current = false;
    };
  }, [isMounted]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (discountedPrice >= regularPrice) {
      setLoading(false);
      toast.error("Discounted price needs to be less than regular price");
      return;
    }

    if (images.length > 6) {
      setLoading(false);
      toast.error("Max 6 images per listing");
      return;
    }

    let geolocation = {};
    let location;

    if (geolocationEnable) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`
      );

      const data = await response.json();
      geolocation.lat = data.results[0]?.geometry.location.lat ?? 0;
      geolocation.lng = data.results[0]?.geometry.location.lng ?? 0;

      location =
        data.status === "ZERO_RESULTS"
          ? undefined
          : data.results[0]?.formatted_address;

      if (location === undefined || location.includes("undefined")) {
        setLoading(false);
        toast.error("Please, enter a correct address");
        return;
      }
    } else {
      geolocation.lat = latitude;
      geolocation.lng = longitude;
    }

    //Store images on firebase
    const storeImage = async (image) => {
      return new Promise((resolve, reject) => {
        const storage = getStorage();
        const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`;

        const storageRef = ref(storage, "images/" + fileName);
        const uploadTask = uploadBytesResumable(storageRef, image);
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

            switch (snapshot.state) {
              case "paused":
                break;
              case "running":
                break;
              default:
                break;
            }
          },
          (error) => {
            reject(error);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) =>
              resolve(downloadURL)
            );
          }
        );
      });
    };

    const imgUrls = await Promise.all(
      [...images].map((image) => storeImage(image))
    ).catch(() => {
      setLoading(false);
      toast.error("Images not uploaded");
      return;
    });

    const formDataCopy = {
      ...formData,
      imgUrls,
      geolocation,
      timestamp: serverTimestamp(),
    };

    formDataCopy.location = address;
    delete formDataCopy.images;
    delete formDataCopy.address;
    !formDataCopy.offer && delete formDataCopy.discountedPrice;

    const docRef = await addDoc(collection(db, "listings"), formDataCopy);
    setLoading(false);
    toast.success("Listing saved");
    navigate(`/category/${formDataCopy.type}/${docRef.id}`);
  };

  const onMutate = (e) => {
    // Check true or false
    let boolean = null;
    if (e.target.value === "true") {
      boolean = true;
    }
    if (e.target.value === "false") {
      boolean = false;
    }

    //   Check files
    if (e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        images: e.target.files,
      }));
    }

    //   Check text/numbers/bollean
    if (!e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        [e.target.id]: boolean ?? e.target.value,
      }));
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="profile">
      <header>
        <p className="pageHeader">Create a Listing</p>
      </header>
      <main>
        <form onSubmit={onSubmit}>
          <label htmlFor="type" className="formLabel">
            Sell / Rent
          </label>
          <div className="formButtons">
            <button
              type="button"
              className={type === "sale" ? "formButtonActive" : "formButton"}
              id="type"
              value="sale"
              onClick={onMutate}
            >
              Sell
            </button>
            <button
              type="button"
              className={type === "rent" ? "formButtonActive" : "formButton"}
              id="type"
              value="rent"
              onClick={onMutate}
            >
              Rent
            </button>
          </div>
          <label htmlFor="name" className="formLabel">
            Name
          </label>
          <input
            type="text"
            className="formInputName"
            id="name"
            value={name}
            onChange={onMutate}
            maxLength="32"
            minLength="10"
            required
          />
          <div className="formRooms flex">
            <div>
              <label htmlFor="bedrooms" className="formLabel">
                Bedrooms
              </label>
              <input
                type="number"
                className="formInputSmall"
                id="bedrooms"
                value={bedrooms}
                onChange={onMutate}
                min="1"
                max="50"
                required
              />
            </div>
            <div>
              <label htmlFor="bathrooms" className="formLabel">
                Bathrooms
              </label>
              <input
                type="number"
                className="formInputSmall"
                id="bathrooms"
                value={bathrooms}
                onChange={onMutate}
                min="1"
                max="50"
                required
              />
            </div>
          </div>
          <label htmlFor="parking" className="formLabel">
            Parking Spot
          </label>
          <div className="formButtons">
            <button
              className={parking ? "formButtonActive" : "formButton"}
              type="button"
              id="parking"
              value={true}
              onClick={onMutate}
              min="1"
              max="50"
            >
              Yes
            </button>
            <button
              className={!parking ? "formButtonActive" : "formButton"}
              type="button"
              id="parking"
              value={false}
              onClick={onMutate}
              min="1"
              max="50"
            >
              No
            </button>
          </div>
          <label htmlFor="furnished" className="formLabel">
            Furnished
          </label>
          <div className="formButtons">
            <button
              className={furnished ? "formButtonActive" : "formButton"}
              type="button"
              id="furnished"
              value={true}
              onClick={onMutate}
              min="1"
              max="50"
            >
              Yes
            </button>
            <button
              className={!furnished ? "formButtonActive" : "formButton"}
              type="button"
              id="furnished"
              value={false}
              onClick={onMutate}
              min="1"
              max="50"
            >
              No
            </button>
          </div>
          <label htmlFor="address" className="formLabel">
            Address
          </label>
          <textarea
            name="address"
            id="address"
            className="formInputAddress"
            value={address}
            onChange={onMutate}
            required
          ></textarea>
          {!geolocationEnable && (
            <div className="formLatLng flex">
              <div>
                <label htmlFor="latitude" className="formLabel">
                  Latitude
                </label>
                <input
                  className="formInputSmall"
                  type="number"
                  name="latitude"
                  id="latitude"
                  value={latitude}
                  onChange={onMutate}
                  required
                />
              </div>
              <div>
                <label htmlFor="longitude" className="formLabel">
                  Longitude
                </label>
                <input
                  className="formInputSmall"
                  type="number"
                  name="longitude"
                  id="longitude"
                  value={longitude}
                  onChange={onMutate}
                  required
                />
              </div>
            </div>
          )}
          <label htmlFor="offer" className="formLabel">
            Offer
          </label>
          <div className="formButtons">
            <button
              className={offer ? "formButtonActive" : "formButton"}
              type="button"
              id="offer"
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !offer && offer !== null ? "formButtonActive" : "formButton"
              }
              type="button"
              id="offer"
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>
          <label htmlFor="regularPrice" className="formLabel">
            Regular Price
          </label>
          <div className="formPriceDiv">
            <input
              className="formInputSmall"
              type="number"
              name="regularPrice"
              id="regularPrice"
              value={regularPrice}
              onChange={onMutate}
              min="50"
              max="9999999999"
              required
            />
            {type === "rent" && <p className="formPriceText">/ per month</p>}
          </div>
          {offer && (
            <>
              <label htmlFor="discountedPrice" className="formLabel">
                Discounted Price
              </label>
              <input
                className="formInputSmall"
                type="number"
                name="discountedPrice"
                id="discountedPrice"
                value={discountedPrice}
                onChange={onMutate}
                min="50"
                max="9999999999"
                required={offer}
              />
            </>
          )}

          <label htmlFor="images" className="formLabel">
            Images
          </label>
          <p className="imagesInfo">
            The first image will be the cover (max 6).
          </p>
          <input
            type="file"
            className="formInputFile"
            id="images"
            name="images"
            onChange={onMutate}
            max="6"
            accept=".jpg,.png,.jpeg"
            multiple
            required
          />
          <button className="primaryButton createListingButton" type="submit">
            Create Listing
          </button>
        </form>
      </main>
    </div>
  );
}

export default CreateListing;
