export const priceFormat = (price) => {
  const regex = /\B(?=(\d{3})+(?!\d))/g;
  return price.toString().replace(regex, ",");
};
