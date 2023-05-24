import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject, // TODO: Import deleteObject function from firebase/storage
} from 'firebase/storage';
import { serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import Spinner from '../components/Spinner';


function EditListing() {
  // eslint-disable-next-line
  const [geolocationEnabled, setGeolocationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(false);
  const [imagesToRemove, setImagesToRemove] = useState([]); // TODO: instantiate state as an array for Images the user wants to delete
  const [formData, setFormData] = useState({
    type: 'rent',
    name: '',
    bedrooms: 1,
    bathrooms: 1,
    parking: false,
    furnished: false,
    address: '',
    offer: false,
    regularPrice: 0,
    discountedPrice: 0,
    images: {},
    latitude: 0,
    longitude: 0,
  });

  // Unpack FormData
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

  const params = useParams();
  const auth = getAuth();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  // Redirect if listing is not user's
  useEffect(() => {
    if (listing && listing.userRef !== auth.currentUser.uid) {
      toast.error("You're not authorized to edit that listing");
      navigate('/');
    }
  });

  // Fetch listing to edit
  useEffect(() => {
    const fetchListing = async () => {
      const docRef = doc(db, 'listings', params.listingId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setListing(docSnap.data());
        setFormData({ ...docSnap.data(), address: docSnap.data().location });
        setLoading(false);
      } else {
        navigate('/');
        toast.error('Listing does not exist');
      }
    };

    fetchListing();
  }, [params.listingId, navigate]);

  // Sets userRef to logged in user
  useEffect(() => {
    if (isMounted) {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setFormData({ ...formData, userRef: user.uid });
        } else {
          navigate('/sign-in');
        }
      });
    }

    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  //! TODO: Apply Restriction on Geocode and Firebase API keys specific to this website after deployment
  //! MUST ENABLE GEOCODE API FROM YOUR GOOGLE CONSOLE
  // 1. Go to https://www.console.cloud.google.com
  // 2. Select "API & Services" from the Dropdown
  // 3. Click Enable APIs & Services (If geocode not yet enabled)
  // 4. Search for Geocoding API --> Select Geocoding API --> Click Enable

  const onSubmit = async (e) => {
    e.preventDefault();

    // Verify that discounted price is lower than regular
    if (discountedPrice >= regularPrice) {
      setLoading(false);
      toast.error('Discounted Price must be lower than Regular Price');
      return;
    }

    // // Verify Images are 6 or less
    // if (images?.length > 6) {
    //   setLoading(false);
    //   toast.error('Max 6 Images');
    // }

    // GEOCODING
    let geolocation = {};
    let location;

    if (geolocationEnabled) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`
      );

      const data = await response.json();

      // Set geolocation if returned
      geolocation.lat = data.results[0]?.geometry.location.lat ?? 0;
      geolocation.lng = data.results[0]?.geometry.location.lng ?? 0;

      // If data returned results, set the address to formatted address
      location =
        data.status === 'ZERO_RESULTS'
          ? undefined
          : data.results[0]?.formatted_address;

          console.log(data)

      // Throw error if location wasn't returned
      if (location === undefined || location.includes('undefined')) {
        setLoading(false);
        toast.error('Please enter a correct address');
        return;
      }
    } else {
      geolocation.lat = latitude;
      geolocation.lng = longitude;
    }

    // Store image in firebase
    const storeImage = async (image) => {
      return new Promise((resolve, reject) => {
        const storage = getStorage();
        const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`;

        // create storage reference --> pass in storage + path + filename
        const storageRef = ref(storage, 'images/' + fileName);

        // Upload the file metadata
        const uploadTask = uploadBytesResumable(storageRef, image);

        // Register three observers:
        // 1. 'state_changed' observer, called any time the state changes
        // 2. Error observer, called on failure
        // 3. Completion observer, called on successful completion
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Observe state change events such as progress, pause, and resume
            // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            switch (snapshot.state) {
              case 'paused':
                console.log('Upload is paused');
                break;
              case 'running':
                console.log('Upload is running');
                break;
              default:
                break;
            }
          },
          (error) => {
            console.log(error);
            reject(error);
          },
          () => {
            // Handle successful uploads on complete
            // For instance, return the download URL: https://firebasestorage.googleapis.com/...
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
              resolve(downloadURL);
            });
          }
        );
      });
    };

    // TODO: Throw an error if new image TOTAL is not 6 or less
    const availableImageStorage =
      6 - listing.imgUrls.length + imagesToRemove.length;
    // Return an error only if new images were added AND the total files exceeds 6
    if (images && images.length > availableImageStorage) {
      setLoading(false);
      toast.error(
        'Image Upload failed - Too many total images for this listing'
      );
      return;
    }

    // TODO: IF new images were uploaded, Store the returned imgUrls in a new array
    let newimgUrls;
    if (images) {
      newimgUrls = await Promise.all(
        [...images].map((image) => storeImage(image))
      ).catch(() => {
        setLoading(false);
        toast.error('Images not uploaded');
        return;
      });
    }

    // TODO: Function to Delete an Image from Storage from Storage
    const deleteImage = async (imgUrl) => {
      // Split Url to get the filename in the middle
      let fileName = imgUrl.split('images%2F');
      fileName = fileName[1].split('?alt');
      fileName = fileName[0];
      console.log(fileName)

      const storage = getStorage();

      // Create a reference to the file to delete
      const imgRef = ref(storage, `images/${fileName}`);

      // Returns a promise
      return deleteObject(imgRef);
    };

    //TODO: Delete each image in imagesToRemove from storage
    imagesToRemove.forEach(async (imgUrl) => {
      try {
        await deleteImage(imgUrl)
        toast.success('Image was successfully removed from storage');
      } catch (error) {
        console.log(error);
          toast.error('Deletion failed');
          setLoading(false);
      }
      
    });

    //TODO: Remove all imagesToRemove from current imgUrls for this listing
    const remainingListingImages = listing.imgUrls.filter(
      (val) => !imagesToRemove.includes(val)
    );

    //TODO: Merge imgUrls with newimgUrls (if defined) --> Then Delete newimgUrls
    let mergedimgUrls;
    if (newimgUrls) {
      mergedimgUrls = [...remainingListingImages, ...newimgUrls];
    } else {
      mergedimgUrls = [...remainingListingImages];
    }

    // Create a separate copy of the formData, then add/delete fields as needed to match collection keys
    const formDataCopy = {
      ...formData,
      imgUrls: mergedimgUrls,
      geolocation,
      timestamp: serverTimestamp(),
    };

    // Removes any leading zeros from price
    if (formDataCopy.discountedPrice) {
      formDataCopy.discountedPrice = parseInt(
        formData.discountedPrice.toString(),
        10
      );
    }
    formDataCopy.regularPrice = parseInt(formData.regularPrice.toString(), 10);

    formDataCopy.location = address;
    delete formDataCopy.images;
    delete formDataCopy.address;
    !formDataCopy.offer && delete formDataCopy.discountedPrice; // Remove discountedPrice if no offer

    // Update in firestore
    const docRef = doc(db, 'listings', params.listingId);
    await updateDoc(docRef, formDataCopy);
    setLoading(false);
    toast.success('Listing saved');
    navigate(`/category/${formDataCopy.type}/${docRef.id}`);
  };

  // Form Data Changed
  const onMutate = (e) => {
    // let boolean = null;
    let newValue = e.target.value;

    // Edge Cases to prevent booleans from converting to strings
    if (e.target.value === 'true') {
      newValue = true;
    }
    if (e.target.value === 'false') {
      newValue = false;
    }

    // Files
    if (e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        images: e.target.files,
      }));
    }

    // All other
    if (!e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        [e.target.id]: newValue,
      }));
    }
  };

  // TODO: handleChange on image checkboxes
  const handleChange = (e) => {
    if (e.target.checked) {
      // Case 1 : The user checks the box
      setImagesToRemove([...imagesToRemove, e.target.value]);
    } else {
      // Case 2  : The user unchecks the box
      setImagesToRemove((current) =>
        current.filter((url) => {
          return url !== e.target.value;
        })
      );
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="profile">
      <header>
        <p className="pageHeader">Edit Listing</p>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <label className="formLabel">Sell / Rent</label>
          <div className="formButtons">
            <button
              type="button"
              className={type === 'sale' ? 'formButtonActive' : 'formButton'}
              id="type"
              value="sale"
              onClick={onMutate}
            >
              Sell
            </button>
            <button
              type="button"
              className={type === 'rent' ? 'formButtonActive' : 'formButton'}
              id="type"
              value="rent"
              onClick={onMutate}
            >
              Rent
            </button>
          </div>

          <label className="formLabel">Name</label>
          <input
            className="formInputName"
            type="text"
            id="name"
            value={name}
            onChange={onMutate}
            maxLength="32"
            minLength="10"
            required
          />

          <div className="formRooms flex">
            <div>
              <label className="formLabel">Bedrooms</label>
              <input
                className="formInputSmall"
                type="number"
                id="bedrooms"
                value={bedrooms}
                onChange={onMutate}
                min="1"
                max="50"
                required
              />
            </div>
            <div>
              <label className="formLabel">Bathrooms</label>
              <input
                className="formInputSmall"
                type="number"
                id="bathrooms"
                value={bathrooms}
                onChange={onMutate}
                min="1"
                max="50"
                required
              />
            </div>
          </div>

          <label className="formLabel">Parking spot</label>
          <div className="formButtons">
            <button
              className={parking ? 'formButtonActive' : 'formButton'}
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
              className={
                !parking && parking !== null ? 'formButtonActive' : 'formButton'
              }
              type="button"
              id="parking"
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          <label className="formLabel">Furnished</label>
          <div className="formButtons">
            <button
              className={furnished ? 'formButtonActive' : 'formButton'}
              type="button"
              id="furnished"
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !furnished && furnished !== null
                  ? 'formButtonActive'
                  : 'formButton'
              }
              type="button"
              id="furnished"
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          <label className="formLabel">Address</label>
          <textarea
            className="formInputAddress"
            type="text"
            id="address"
            value={address}
            onChange={onMutate}
            required
          />

          {!geolocationEnabled && (
            <div className="formLatLng flex">
              <div>
                <label className="formLabel">Latitude</label>
                <input
                  className="formInputSmall"
                  type="number"
                  id="latitude"
                  value={latitude}
                  onChange={onMutate}
                  required
                />
              </div>
              <div>
                <label className="formLabel">Longitude</label>
                <input
                  className="formInputSmall"
                  type="number"
                  id="longitude"
                  value={longitude}
                  onChange={onMutate}
                  required
                />
              </div>
            </div>
          )}

          <label className="formLabel">Offer</label>
          <div className="formButtons">
            <button
              className={offer ? 'formButtonActive' : 'formButton'}
              type="button"
              id="offer"
              value={true}
              onClick={onMutate}
            >
              Yes
            </button>
            <button
              className={
                !offer && offer !== null ? 'formButtonActive' : 'formButton'
              }
              type="button"
              id="offer"
              value={false}
              onClick={onMutate}
            >
              No
            </button>
          </div>

          <label className="formLabel">Regular Price</label>
          <div className="formPriceDiv">
            <input
              className="formInputSmall"
              type="number"
              id="regularPrice"
              value={regularPrice}
              onChange={onMutate}
              min="50"
              max="750000000"
              required
            />
            {type === 'rent' && <p className="formPriceText">$ / Month</p>}
          </div>

          {offer && (
            <>
              <label className="formLabel">Discounted Price</label>
              <input
                className="formInputSmall"
                type="number"
                id="discountedPrice"
                value={discountedPrice}
                onChange={onMutate}
                min="50"
                max="750000000"
                required={offer}
              />
            </>
          )}

          {/* TODO: Display Current Images (Noting Cover) with Delete Buttons --> Then display "Add Image" Option */}
          <label className="formLabel">Listing Images</label>
          <p style={{ paddingLeft: '10px', fontSize: '0.8rem' }}>
            DELETE: Check the box of each image you wish to delete
          </p>
          <div className="editListingImgContainer">
            {listing?.imgUrls &&
              listing.imgUrls.map((img, index) => (
                <div
                  key={index}
                  className="editListingImg"
                  style={{
                    background: `url(${img}) center no-repeat`,
                    backgroundSize: 'cover',
                  }}
                >
                  {index === 0 && <p className="editListingImgText">Cover</p>}

                  <input
                    type="checkbox"
                    id="imageDelete"
                    name="imageDelete"
                    value={img}
                    onChange={handleChange}
                  />
                </div>
              ))}
          </div>
          {/* Displays the number of remaining spots available after checked images are deleted */}
          <p style={{ paddingLeft: '10px', fontSize: '0.8rem' }}>
            ADD: Choose files to add. (
            {listing?.imgUrls &&
              imagesToRemove &&
              ` ${
                6 - listing.imgUrls.length + imagesToRemove.length
              } image slots remaining`}{' '}
            - Max 6 total )
          </p>
          {/*  */}

          <input
            className="formInputFile"
            type="file"
            id="images"
            onChange={onMutate}
            max="6"
            accept=".jpg,.png,.jpeg"
            multiple
          />
          <button type="submit" className="primaryButton createListingButton">
            Update Listing
          </button>
        </form>
      </main>
    </div>
  );
}

export default EditListing;