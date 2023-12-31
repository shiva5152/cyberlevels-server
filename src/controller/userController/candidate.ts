import catchAsyncError from "../../middleware/catchAsyncError";
import ErrorHandler from "../../utils/errorHandler";
import axios from "axios";
import dotenv from 'dotenv';
import Candidate from "../../model/user/Candidate";
import { sendToken } from "../../utils/sendToken";
import Employer from "../../model/user/Employer";
import { IEmployer, ICandidate } from "../../types/user";
import fs from 'fs';
import mongoose from "mongoose";
import { getUrlForDeletePdf, getUrlForDownloadPdf, getUrlForPdf, getUrlForUploadProfile } from "../../utils/uploadToS3";
import JobPost from "../../model/JobPost";
import { calculateMatchScore } from "../../utils/helper";
import Company from "../../model/Company";
dotenv.config();

const serverGeneratedState = "12345678"

export const getUserLinkedIn = catchAsyncError(async (req, res, next) => {

    if (req.body.hasOwnProperty('error')) {
        const { error_description } = req.body;
        return next(new ErrorHandler(error_description, 401))
    }
    const { code, state } = req.body;
    if (serverGeneratedState !== state) {
        return next(new ErrorHandler("candidate is not authorized", 401))
    }
    // make a req by using code to get access token
    const clientId = process.env.CLIENT_ID || "";
    const callbackUrl = process.env.CALLBACK_URL || "";
    const clientSecret = process.env.CLIENT_SECRET || ""
    let accessToken = ''
    try {
        const { data } = await axios.post(`https://www.linkedin.com/oauth/v2/accessToken?code=${code}&grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${callbackUrl}`)
        accessToken = data.access_token;
        // console.log(data);
    } catch (error: any) {
        // console.log(error)
        return next(new ErrorHandler("error while getting accessToken", 400))

    }
    let response;
    try {
        const { data } = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })
        // console.log(data);
        response = data;
    } catch (error) {
        // console.log(error)
        return next(new ErrorHandler("error while getting userInfo", 400))
    }
    const { role } = req.body;
    let user: ICandidate | IEmployer | null = null;
    const Obj = {
        email: response.email,
        firstName: response.given_name,
        lastName: response.family_name,
        avatar: response.picture,
        isEmailVerified: response.email_verified,
    }
    if (role == 'employer') {

        user = await Employer.findOne({ email: response.email });
        if (!user) {
            user = await Employer.create(Obj);
        }
    }
    if (role == 'candidate') {
        user = await Candidate.findOne({ email: response.email });
        if (!user) {
            user = await Candidate.create(Obj);
        }
    }

    sendToken(user, 201, res, accessToken);

})
export const getCurrCandidate = catchAsyncError(async (req, res, next) => {
    const { id } = req.params
    // middleware should be there for authentication
    if (!id) {
        return next(new ErrorHandler("Candidate Id Not Found", 400))
    }
    // console.log(id)
    const candidate = await Candidate.findById({ _id: id });
    if (!candidate) {
        return next(new ErrorHandler("Candidate Not Found", 404));
    }
    candidate.notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.status(200).json({
        success: true,
        candidate,
    });
})
export const updateCurrCandidate = catchAsyncError(async (req, res, next) => {

    if (!req.body) {
        return next(new ErrorHandler("body not found", 400));
    }
    const { id } = req.params;
    const candidate = await Candidate.findOneAndUpdate({ _id: id }, req.body, { new: true });
    if (!candidate) {
        return next(new ErrorHandler("something went wrong ,try again", 500));
    }
    res.status(200).json({
        success: true,
        candidate
    })
})

export const signupCandidate = catchAsyncError(async (req, res, next) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return next(new ErrorHandler("please provide all values", 400))
    }
    const candidateAlreadyExists = await Candidate.findOne({ email });
    if (candidateAlreadyExists) {
        return next(new ErrorHandler("Email already in exist", 400))
    }
    const firstName = name.split(" ")[0].trim();
    const lastName = name.split(" ")[1] ? name.split(" ")[1] : "."
    const candidate = await Candidate.create({ firstName, lastName, email, password, isEmailVerified: false })

    sendToken(candidate, 201, res);
})
export const loginCandidate = catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(new ErrorHandler("please provide all values", 400))
    }

    const candidate = await Candidate.findOne({ email }).select("+password");
    const employer = await Employer.findOne({ email }).select("+password");
    if (!candidate && !employer) {
        return next(new ErrorHandler("Invalid  Email or Password", 400))
    }
    if (candidate) {
        const verifyPassword = await candidate.comparePassword(password);
        if (!verifyPassword) {
            return next(new ErrorHandler("Invalid  Email or Password", 401))
        }
    }
    if (employer) {
        const verifyPassword = await employer.comparePassword(password);
        if (!verifyPassword) {
            return next(new ErrorHandler("Invalid  Email or Password", 401))
        }
    }



    sendToken(candidate ? candidate : employer, 201, res);
})
export const logoutCandidate = catchAsyncError(async (req, res, next) => {

    res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
    }).status(200).json({
        success: true,
        message: "Logged Out Successfully"
    });
})
export const getAllCandidate = catchAsyncError(async (req, res, next) => {

    const { keyword, location, candidateType, preferredExperience, page, employerId } = req.query;


    if (!employerId) {
        return next(new ErrorHandler("Employer Id not Found", 404))
    }
    const myKeyWord = keyword as string

    const queryObject: any = {}
    if (location) {
        let desiredLocation: string | string[] = location as string;
        desiredLocation = desiredLocation.split(",");
        queryObject.location = { $in: desiredLocation }
    }
    if (keyword) {
        // queryObject.skills = { $in: [new RegExp(myKeyWord, 'i')] };
        queryObject.firstName = { $regex: myKeyWord, $options: "i" };
    }
    if (candidateType) {
        queryObject.gender = candidateType
    }

    if (preferredExperience) {
        let desiredExperience: string | string[] = preferredExperience as string
        desiredExperience = desiredExperience.split(",");
        queryObject.experienceInShort = { $all: desiredExperience };
    }
    //user provides a number, such as salary=4, to find job posts with salary ranges that include this number:

    console.log(page)
    const p = Number(page) || 1;
    const limit = 8;
    const skip = (p - 1) * limit;

    let candidates = await Candidate.find(queryObject).skip(skip).limit(limit);
    const totalCandidate = await Candidate.countDocuments(queryObject);
    const totalNumOfPage = Math.ceil(totalCandidate / limit);

    // is Candidate Saved by the Employer who is requesting
    const employer = await Employer.findById(employerId);
    if (!employer) {
        return next(new ErrorHandler("User not Found", 401))
    }
    const savedCandidates = employer.savedCandidates as string[];
    let result = candidates.map((candidate) => {
        const isSaved = savedCandidates.includes(candidate._id);
        const candidateObject = candidate.toObject();
        return {
            ...candidateObject,
            isSaved
        }
    })

    res.status(200).json({
        success: true,
        totalNumOfPage,
        totalCandidate,
        result,
    });

})
export const getDetails = catchAsyncError(async (req, res, next) => {

    const { id } = req.params;

    const user = req.user as IEmployer;
    if (user && user.subscription.viewProfileLimit === 0) {
        return next(new ErrorHandler("Upgrade your Plan to view more profile", 400));
    }

    const candidate = await Candidate.findById({ _id: id });
    if (candidate) {
        candidate.profileViews++;
        await candidate.save();
    }
    user.subscription.viewProfileLimit--;
    await user.save();

    res.status(200).json({
        success: true,
        candidate
    });

})

export const updateNotification = catchAsyncError(async (req, res, next) => {

    const { candidateId } = req.body;
    const { id } = req.params

    const notificationId = new mongoose.Types.ObjectId(id);
    const candidate = await Candidate.findOneAndUpdate(
        { _id: candidateId, 'notifications._id': notificationId },
        {
            $set: {
                'notifications.$.isRead': true,
            },
        },
        { new: true }
    );
    res.status(200).json({
        success: true,
        candidate
    })
})
export const updateEducation = catchAsyncError(async (req, res, next) => {

    if (!req.body) {
        return next(new ErrorHandler("body not found", 400));
    }
    const { id } = req.params;
    let candidate = await Candidate.findOne({ _id: id });
    candidate?.education.push(req.body)
    await candidate?.save();
    if (!candidate) {
        return next(new ErrorHandler("something went wrong ,try again", 500));
    }
    res.status(200).json({
        success: true,

    })
})
export const updateExperience = catchAsyncError(async (req, res, next) => {

    if (!req.body) {
        return next(new ErrorHandler("body not found", 400));
    }
    const { id } = req.params;
    const candidate = await Candidate.findOne({ _id: id });
    candidate?.experience.push(req.body);
    await candidate?.save();
    if (!candidate) {
        return next(new ErrorHandler("something went wrong ,try again", 500));
    }
    res.status(200).json({
        success: true,
    })
})

export const populateCandidate = catchAsyncError(async (req, res, next) => {
    const location = 'mockData/Candidate.json'
    let candidates: any = "";

    fs.readFile(location, 'utf8', async function (err, data) {
        if (err) {
            console.error('There was an error reading the file!', err);
            return;
        }

        candidates = JSON.parse(data);
        await Candidate.insertMany(candidates)
        // console.log(jobPosts[1]);

    });

    res.send({ msg: "true" })

})
// save jobs
export const saveJob = catchAsyncError(async (req, res, next) => {

    const { candidateId, jobPostId, page } = req.body;
    if (!candidateId || !jobPostId) {
        return next(new ErrorHandler("CandidateId or JobPostId not found", 400));
    }
    const candidate = await Candidate.findByIdAndUpdate(candidateId, { $addToSet: { savedJobs: jobPostId } }, { new: true });
    if (!candidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }
    const p = Number(page) || 1;
    const limit = 4;
    const skip = (p - 1) * limit;
    const totalSavedJob = candidate?.savedJobs.length;

    const totalNumOfPage = Math.ceil(totalSavedJob / limit);
    const updatedCandidate = await Candidate.findById(candidateId).populate({
        path: 'savedJobs',
        options: { skip: skip, limit: limit },
    });
    if (!updatedCandidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }

    res.status(200).json({
        success: true,
        savedJobs: updatedCandidate?.savedJobs,
        totalSavedJob,
        totalNumOfPage
    })
})

export const removeSavedJob = catchAsyncError(async (req, res, next) => {

    const { candidateId, jobPostId, page } = req.query;


    if (!candidateId || !jobPostId) {
        return next(new ErrorHandler("CandidateId or JobPostId not found", 400));
    }
    const candidate = await Candidate.findByIdAndUpdate(candidateId, { $pull: { savedJobs: jobPostId } }, { new: true })
    if (!candidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }
    const p = Number(page) || 1;
    const limit = 4;
    const skip = (p - 1) * limit;
    const totalSavedJob = candidate?.savedJobs.length;
    const totalNumOfPage = Math.ceil(totalSavedJob / limit);
    const updatedCandidate = await Candidate.findById(candidateId).populate({
        path: 'savedJobs',
        options: { skip: skip, limit: limit },
    });
    if (!updatedCandidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }


    res.status(200).json({
        success: true,
        savedJobs: updatedCandidate?.savedJobs,
        totalNumOfPage,
        totalSavedJob,
    })
})

export const getSaveJob = catchAsyncError(async (req, res, next) => {

    const { candidateId, page } = req.query;
    if (!candidateId) {
        return next(new ErrorHandler("candidateId not found", 400));

    }
    const candidateTemp = await Candidate.findById(candidateId);
    console.log(candidateTemp);
    if (!candidateTemp) {
        return next(new ErrorHandler("candidateId not found", 401));
    }
    const p = Number(page) || 1;
    const limit = 4;
    const skip = (p - 1) * limit;

    const candidate = await Candidate.findById(candidateId).populate({
        path: 'savedJobs',
        options: { skip: skip, limit: limit },
    });
    if (!candidate) {
        return next(new ErrorHandler("candidate not found", 400));
    }
    const totalSavedJob = candidateTemp?.savedJobs.length;
    // console.log("from candidate", totalSavedJob);
    const totalNumOfPage = Math.ceil(totalSavedJob / limit);
    // console.log(candidate?.savedJobs);
    res.status(200).json({
        success: true,
        savedJobs: candidate?.savedJobs,
        totalNumOfPage,
        totalSavedJob
    })

})

// save companies
export const saveCompany = catchAsyncError(async (req, res, next) => {

    const { candidateId, companyId, page } = req.body;
    if (!candidateId || !companyId) {
        return next(new ErrorHandler("CandidateId or companyId not found", 400));
    }
    const candidate = await Candidate.findByIdAndUpdate(candidateId, { $addToSet: { savedCompanies: companyId } }, { new: true });
    if (!candidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }
    const p = Number(page) || 1;
    const limit = 4;
    const skip = (p - 1) * limit;
    const totalSavedCompany = candidate?.savedCompanies.length;

    const totalNumOfPage = Math.ceil(totalSavedCompany / limit);
    const updatedCandidate = await Candidate.findById(candidateId).populate({
        path: 'savedCompanies',
        options: { skip: skip, limit: limit },
    });
    if (!updatedCandidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }

    res.status(200).json({
        success: true,
        savedCompanies: updatedCandidate?.savedCompanies,
        totalSavedCompany,
        totalNumOfPage
    })
})

export const removeSavedCompany = catchAsyncError(async (req, res, next) => {

    const { candidateId, companyId, page } = req.query;

    if (!candidateId || !companyId) {
        return next(new ErrorHandler("CandidateId or candidateId not found", 400));
    }
    const candidate = await Candidate.findByIdAndUpdate(candidateId, { $pull: { savedCompanies: companyId } }, { new: true })
    if (!candidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }
    const p = Number(page) || 1;
    const limit = 4;
    const skip = (p - 1) * limit;
    const totalSavedCompany = candidate?.savedCompanies.length;

    const totalNumOfPage = Math.ceil(totalSavedCompany / limit);
    const updatedCandidate = await Candidate.findById(candidateId).populate({
        path: 'savedCompanies',
        options: { skip: skip, limit: limit },
    });
    if (!updatedCandidate) {
        return next(new ErrorHandler("Candidate not found", 404));
    }

    res.status(200).json({
        success: true,
        savedCompanies: updatedCandidate?.savedCompanies,
        totalNumOfPage,
        totalSavedCompany,
    })
})

export const getSavedCompany = catchAsyncError(async (req, res, next) => {

    const { candidateId, page } = req.query;

    if (!candidateId) {
        return next(new ErrorHandler("candidateId not found", 400));
    }
    const candidateTemp = await Candidate.findById(candidateId);
    if (!candidateTemp) {
        return next(new ErrorHandler("candidateId not found", 401));
    }
    const p = Number(page) || 1;
    const limit = 4;
    const skip = (p - 1) * limit;

    const candidate = await Candidate.findById(candidateId).populate({
        path: 'savedCompanies',
        options: { skip: skip, limit: limit },
    });
    if (!candidate) {
        return next(new ErrorHandler("candidate not found", 400));
    }
    const companies = candidate?.savedCompanies;
    const totalSavedCompany = candidateTemp?.savedCompanies.length;
    const totalNumOfPage = Math.ceil(totalSavedCompany / limit);

    const result = await Promise.all(companies.map(async (company) => {

        let jobOpenings = 0;
        if (typeof company !== "string") {
            jobOpenings = await JobPost.countDocuments({ companyId: company._id, status: "active" })
            const companyObject = company.toObject()

            return {
                ...companyObject,
                jobOpenings: jobOpenings
            };
        } else return {}
    }));

    res.status(200).json({
        success: true,
        savedCompanies: result,
        totalNumOfPage,
        totalSavedCompany
    })

})

export const uploadResumeToS3 = catchAsyncError(async (req, res, next) => {

    const { name, type, candidateId, } = req.body;
    const url = getUrlForPdf(name, type, candidateId,);
    console.log(url);
    res.json({ success: true, url }).status(200);
})
export const uploadProfileToS3 = catchAsyncError(async (req, res, next) => {

    const { extension, folder, type, userId, } = req.body;
    if (!extension || !folder || !type || !userId) {
        return next(new ErrorHandler("all required data not found", 400));
    }
    const key = `${folder}/${userId}.${extension}`
    const url = getUrlForUploadProfile(key, type);
    res.json({ success: true, url }).status(200);
})
export const updateProfileAvatar = catchAsyncError(async (req, res, next) => {

    const { s3Key, userId, } = req.body;
    if (!s3Key || !userId) {
        return next(new ErrorHandler("all required data not found", 400));
    }
    const publicEndpoint = process.env.AWS_PUBLIC_ENDPOINT;
    if (!publicEndpoint) {
        return next(new ErrorHandler("AWS_PUBLIC_ENDPOINT is not found", 404));
    }

    const avatar = `${publicEndpoint}/${s3Key}`
    console.log(avatar);

    const candidate = await Candidate.findByIdAndUpdate(userId, { avatar });
    if (!candidate) {
        return next(new ErrorHandler("candidate is not found", 404));
    }


    res.status(200).json({
        success: true,
        avatar: avatar
    });
})
export const addResume = catchAsyncError(async (req, res, next) => {

    const { name, s3Key, candidateId } = req.body;
    const candidate = await Candidate.findByIdAndUpdate(candidateId, { $addToSet: { resumes: { name, s3Key } } }, { new: true });
    if (!candidate) {
        return next(new ErrorHandler("candidate not found", 404));
    }
    const resume = candidate.resumes[candidate.resumes.length - 1];
    res.status(200).json({
        success: true,
        resume
    })
})

export const downloadResumeFromS3 = catchAsyncError(async (req, res, next) => {

    const { s3Key, } = req.body;
    const url = getUrlForDownloadPdf(s3Key);
    res.json({ success: true, url }).status(200);
})

export const deleteResumeFromS3 = catchAsyncError(async (req, res, next) => {

    const { s3Key, resumeId, candidateId } = req.query;
    console.log(req.query);
    const url = getUrlForDeletePdf(s3Key as string);

    await axios.delete(url);
    const candidate = await Candidate.findByIdAndUpdate(candidateId, { $pull: { resumes: { _id: resumeId } } });

    res.status(200).json({
        success: true,
        resumeId,

    })
})

export const getRecommendedJobs = catchAsyncError(async (req, res, next) => {

    const { candidateId } = req.query;
    if (!candidateId) {
        return next(new ErrorHandler("candidateId not found", 400));
    }
    const candidate = await Candidate.findById(candidateId);

    if (!candidate) {
        return next(new ErrorHandler("candidate not found", 404));
    }

    const relevantJobs = await JobPost.find({
        $or: [
            { primarySkills: { $in: candidate.skills } },
            { secondarySkills: { $in: candidate.skills } },
        ],
    })
        .sort({ createdAt: -1 })

    const totalPerRequired = 60;
    const jobRecommendations = relevantJobs.map(job => ({
        job: job,
        score: Math.floor(calculateMatchScore(candidate.skills, job.primarySkills, job.secondarySkills)),
    }));

    const sortedRecommendations = jobRecommendations.sort((a, b) => b.score - a.score);
    const filteredRecommendations = sortedRecommendations.filter(job => job.score > totalPerRequired);
    res.status(200).json({
        success: true,
        length: filteredRecommendations.length,
        jobs: filteredRecommendations
    });

})





