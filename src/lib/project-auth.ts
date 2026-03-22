import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

/**
 * Checks if the current authenticated user has access to the specified project.
 * @param projectId The ID of the project to check access for
 * @returns boolean indicating if the user has access
 */
export async function verifyProjectAccess(projectId: string): Promise<boolean> {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as any).id : null;

    if (!userId) {
        return false;
    }

    const member = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId
            }
        }
    });

    return !!member;
}
