import catchAsyncError from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import Company from "../model/Company";
import fs from 'fs'
import Candidate from "../model/user/Candidate";
import JobPost from "../model/JobPost";
import { getUrlForUploadProfile } from "../utils/uploadToS3";

export const addCompany = catchAsyncError(async (req, res, next) => {

    if (!req.body) {
        return next(new ErrorHandler("body not found", 400));
    }
    const { bodyObj, logoMetadata } = req.body;
    const company = await Company.create(bodyObj);
    if (!company) {
        return next(new ErrorHandler("Something went wrong while creating company.", 500));
    }

    const { folder, extension, type } = logoMetadata;
    const key = `${folder}/${company._id}.${extension}`
    const url = getUrlForUploadProfile(key, type);

    res.status(201).json({
        company,
        url,
        success: true,
        message: "Compony created successfully",
    })
})

export const updateLogo = catchAsyncError(async (req, res, next) => {

    const { s3Key, companyId, } = req.body;
    if (!s3Key || !companyId) {
        return next(new ErrorHandler("all required data not found", 400));
    }
    const publicEndpoint = process.env.AWS_PUBLIC_ENDPOINT;
    if (!publicEndpoint) {
        return next(new ErrorHandler("AWS_PUBLIC_ENDPOINT is not found", 404));
    }

    const logo = `${publicEndpoint}/${s3Key}`
    console.log(logo);

    const candidate = await Company.findByIdAndUpdate(companyId, { logo });
    if (!candidate) {
        return next(new ErrorHandler("candidate is not found", 404));
    }


    res.status(200).json({
        success: true,
        logo: logo,
    });
})


export const populateJobPost = catchAsyncError(async (req, res, next) => {
    const location = 'mockData/Company.json'
    let companies: any = ""

    fs.readFile(location, 'utf8', async function (err, data) {
        if (err) {
            console.error('There was an error reading the file!', err);
            return;
        }

        companies = JSON.parse(data);
        await Company.insertMany(companies)
        // console.log(jobPosts[1]);

    });

    res.send({ msg: "true" })

})
export const getDetails = catchAsyncError(async (req, res, next) => {

    const { id } = req.params;
    if (!id) {
        return next(new ErrorHandler("Company not found", 400));
    }

    const company = await Company.findById({ _id: id });

    res.status(200).json({
        company,
        success: true,
    })
})


export const getCompanies = catchAsyncError(async (req, res, next) => {

    const { page, name, teamSize, candidateId } = req.query;
    const queryObject: any = {}
    if (name) {
        queryObject.name = { $regex: name, $options: "i" };
        console.log(name);
    }
    if (teamSize) {
        let desiredTeamSize: string | string[] = teamSize as string;
        desiredTeamSize = desiredTeamSize.split(",");
        queryObject.teamSize = { $in: desiredTeamSize }
    }

    const p = Number(page) || 1;
    const limit = 8;
    const skip = (p - 1) * limit;

    let companies = await Company.find(queryObject).skip(skip).limit(limit);
    const totalCompanies = await Company.countDocuments(queryObject);
    const totalNumOfPage = Math.ceil(totalCompanies / limit);
    // console.log(totalNumOfPage)

    // is companySaved by the candidate who is requesting

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
        return next(new ErrorHandler("User not Found", 401));
    }

    const savedCompanies = candidate.savedCompanies as string[];

    const result = await Promise.all(companies.map(async (company) => {
        const isSaved = savedCompanies.includes(company._id);
        const jobOpenings = await JobPost.countDocuments({ companyId: company._id, status: "active" });
        const companyObject = company.toObject();

        return {
            ...companyObject,
            isSaved,
            jobOpenings
        };
    }));
    res.status(200).json({
        success: true,
        totalNumOfPage,
        totalCompanies,
        result,
    });

})
