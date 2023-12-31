import mongoose, { Document } from "mongoose";
import type { ICompany } from "./company";
import type { IJobPost } from "./jobPost";

export interface AdminDocument extends Document {
    name: string;
    email: string;
    password: string,
    avatar: string,
    role: string;
    createJWT(): string;
    comparePassword(givenPassword: string): Promise<boolean>;
}
interface IEducation {
    degree: string;
    field: string;
    institute: string;
    startYear: string;
    endYear: string;
    description: string;
}
interface IExperience {
    title: string;
    company: string;
    startYear: string;
    endYear: string;
    description: string;
}
interface INotification {
    sender: string,
    message: String,
    redirectUrl: String,
    timestamp: Date,
    isRead: boolean,
    _id: mongoose.Types.ObjectId
}
interface IResume {
    name: String,
    s3Key: String,
}
interface ISocial {
    linkedIn: string,
    twitter: string,
    github: string,
    website: string,
}
interface FSocial {
    linkedIn: string,
    twitter: string,
    facebook: string,
    website: string,
}
interface ISubscription {
    plan: 'starter' | 'gold' | 'diamond';
    jobApplicationLimit: number;
    feedbackLimit: number;
}
interface ESubscription {
    plan: 'starter' | 'gold' | 'diamond';
    requestLimit: number;
    viewProfileLimit: number;
}

export interface ICandidate extends Document {
    email: string;
    isEmailVerified: boolean;
    firstName: string;
    lastName: string;
    avatar: string;
    phoneNumber: string,
    password: string;
    resumes: IResume[],
    signInProvider: "linkedIn" | "jwt"
    skills: string[],
    role: string,
    location: ILocation,
    expectedSalary: {
        currency: string,
        salary: number,
        period: string
    },
    profileCompleted: number,
    experience: IExperience[],
    education: IEducation[],
    socialSites: ISocial;
    experienceInShort: string,
    gender: string,
    bio: string,
    isSaved?: boolean,
    savedJobs: string[] | IJobPost[];
    savedCompanies: string[] | ICompany[];
    notifications: INotification[];
    profileViews: number;
    subscription: ISubscription
    createJWT(accessToken?: string): string;
    comparePassword(givenPassword: string): Promise<boolean>;
}



export interface IEmployer extends Document {
    email: string;
    isEmailVerified: boolean;
    firstName: string;
    lastName: string;
    avatar: string;
    phoneNumber: string,
    company: {
        name: string,
        companyId: mongoose.Types.ObjectId,
    },
    password?: string;
    location: ILocation,
    resume: string,
    industry: string,
    socialSites: FSocial;
    description: string,
    gender: "male" | "female" | "others";
    freeCount: string;
    jobs: string[],
    role: string,
    bio: string,
    subscription: ESubscription,
    signInProvider?: "linkedIn" | "jwt"
    savedCandidates: string[],
    _id: string,
    createJWT(accessToken?: string): string;
    comparePassword(givenPassword: string): Promise<boolean>;

}

export interface ILocation {
    locality: string;
    city: string;
    state: string;
    country: string;
    zipcode: string;
    maplocation: string;
}

export interface IControlledFieldSchema extends Document {
    companyCategory: string[],
    jobTitle: string[],
    jobCategory: string[],
    jobIndustry: string[],
}

