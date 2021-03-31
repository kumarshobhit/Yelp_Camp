const express = require('express')
var router = express.Router()
const CampGround = require('../models/campground.js')
const { campgroundSchema } = require('../schemas.js');
const { isLoggedIn, isAuth, validateCampground } = require('../middleware');
const AppError = require('../utils/AppError')
const WrapAsync = require('../utils/ErrorHandle.js')
const multer = require('multer')
const { storage, cloudinary } = require('../cloudinary')
const upload = multer({ storage })
var geo = require('mapbox-geocoding');
geo.setAccessToken('pk.eyJ1Ijoic2hvYmhpdGtyIiwiYSI6ImNrbW9mNGhrMDIzdTIybm1pOWxsazNremUifQ.7eP9sW_LO7_edqthxGNZfQ');

const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });





router.get('/', WrapAsync(async (req, res) => {
    const campgrounds = await CampGround.find({})
    res.render('campground/index', { campgrounds })
}))

router.get('/new', isLoggedIn, async (req, res) => {
    res.render('campground/new')
})

router.post('/', isLoggedIn, upload.array('image'), validateCampground, WrapAsync(async (req, res) => {
    const newProduct = new CampGround(req.body.campground)
    newProduct.author = req.user._id
    for (let img of req.files) {
        newProduct.images.push({ url: img.path, filename: img.originalname })
    }
    // // Geocode an address to coordinates
    // geo.geocode('mapbox.places', req.body.campground.location, function (err, geoData) {
    //     newProduct.geometry = geoData.features[0].geometry
    //     console.log(newProduct.geometry)

    // });

    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send()
    newProduct.geometry = geoData.body.features[0].geometry;
    await newProduct.save()
    console.log(newProduct)
    req.flash('success', 'created a new camground');
    res.redirect(`/campgrounds/${newProduct._id}`)



}))


router.get('/:id', WrapAsync(async (req, res) => {
    const { id } = req.params
    const camp = await CampGround.findById(id).populate('reviews').populate('author')
    res.render('campground/show', { camp });
}))

router.get('/:id/edit', isLoggedIn, isAuth, WrapAsync(async (req, res) => {
    const { id } = req.params
    const camp = await CampGround.findById(id)
    res.render('campground/edit', { camp });

}))


router.put('/:id', isLoggedIn, isAuth, upload.array('image'), validateCampground, WrapAsync(async (req, res, next) => {
    if (!req.body.campground) throw new AppError(400, 'something went wrong')
    const { id } = req.params
    const editComm = req.body.campground
    const camp = await CampGround.findByIdAndUpdate(id, editComm, { runValidators: true, new: true })
    for (let img of req.files) {
        camp.images.push({ url: img.path, filename: img.originalname })
    }
    await camp.save()
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await camp.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } })
    }
    req.flash('success', 'updated the  camground');
    res.redirect(`/campgrounds/${camp._id}`)

}))


router.delete('/:id', isLoggedIn, isAuth, WrapAsync(async (req, res) => {
    const { id } = req.params
    const deletedProduct = await CampGround.findByIdAndDelete(id);
    req.flash('success', 'deleted the  camground');
    res.redirect('/campgrounds')
}))

module.exports = router