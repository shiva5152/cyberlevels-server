import catchAsyncError from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import JobApp from "../model/JobApp";
import Candidate from "../model/user/Candidate";
import { ICandidate } from "../types/user";

export const createJobApp = catchAsyncError(async (req, res, next) => {

    if (!req.body) {
        return next(new ErrorHandler("body not found", 400));
    }
    const { candidate, jobPost } = req.body

    if (!candidate || !jobPost) {
        return next(new ErrorHandler("candidate or jobPost is missing", 400));
    }
    const user = req.user as ICandidate;
    if (user && user.subscription.jobApplicationLimit === 0) {
        return next(new ErrorHandler("You can't Apply more with you current plan Upgrade your plan to increase you daily limit maximum jobs you can apply", 400));
    }

    const jobApp = await JobApp.create(req.body);
    user.subscription.jobApplicationLimit--;
    await user.save()

    res.status(200).json({
        jobApp,
        success: true,
    })
})

export const getAllAppByCandidate = catchAsyncError(async (req, res, next) => {

    const { id: candidate } = req.params
    if (!candidate) {
        return next(new ErrorHandler("candidate no found", 404));
    }
    console.log(candidate);
    const allJobApp = await JobApp.find({ candidate });
    console.log(allJobApp.length);


    res.status(200).json({
        allJobApp,
        success: true,
    })
})

export const getAllJobAppByCandidate = catchAsyncError(async (req, res, next) => {

    const { id: candidate } = req.params
    if (!candidate) {
        return next(new ErrorHandler("candidate no found", 404));
    }

    // const allJobApp = await JobApp.find({ candidate });
    // const allJobPost= await JobPost.find()
    const allJobApp = await JobApp.find({ candidate }).sort({ createdAt: -1 }).populate('jobPost');

    res.status(200).json({
        allJobApp,
        success: true,
    })
})
export const getAllCandidateAppByJob = catchAsyncError(async (req, res, next) => {

    const { id: jobPost } = req.params
    if (!jobPost) {
        return next(new ErrorHandler("candidate no found", 404));
    }

    const allJobApp = await JobApp.find({ jobPost }).sort({ createdAt: -1 }).populate('candidate');

    res.status(200).json({
        allJobApp,
        success: true,
    })
})

export const getAllAppByJobPost = catchAsyncError(async (req, res, next) => {

    const { id: jobPost } = req.params;
    if (!jobPost) {
        return next(new ErrorHandler("jobPost no found", 404));
    }
    const allJobApp = await JobApp.find({ jobPost });


    res.status(200).json({
        allJobApp,
        success: true,
    })
})

export const updateStatus = catchAsyncError(async (req, res, next) => {

    const { status, id, candidateId, employerId, redirectUrl } = req.body;
    console.log(req.body);

    if (!status) {
        return next(new ErrorHandler("status not found", 404));
    }

    const jobApp = await JobApp.findById({ _id: id });
    if (!jobApp) {
        return next(new ErrorHandler("Job Application not found", 404));
    }
    jobApp.status = status;
    await jobApp.save();

    const notification = {
        sender: employerId,
        message: 'There is update in your job Application',
        redirectUrl
    };

    // Add the notification to the recipient's user document
    const candidate = await Candidate.findByIdAndUpdate(candidateId, {
        $push: { notifications: notification },
    }, { new: true });
    if (!candidate) {
        return next(new ErrorHandler("candidate not  found", 404));
    }
    const notificationObject = candidate.notifications[candidate.notifications.length - 1];
    console.log(notificationObject);

    res.status(200).json({
        success: true,
        notification: notificationObject
    })
})


