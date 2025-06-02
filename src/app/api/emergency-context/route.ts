import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {getEmergencyContext, type GetEmergencyContextInput} from '@/ai/flows/emergency-flow-context';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const emergencyType = searchParams.get('type');

    if (!emergencyType) {
      return NextResponse.json({error: 'Emergency type is required'}, {status: 400});
    }

    const aiInput: GetEmergencyContextInput = {
      emergencyType,
    };
    
    const result = await getEmergencyContext(aiInput);
    
    return NextResponse.json(result, {status: 200});

  } catch (error) {
    console.error('Emergency Context API Error:', error);
    return NextResponse.json({error: 'Failed to get emergency context.'}, {status: 500});
  }
}
