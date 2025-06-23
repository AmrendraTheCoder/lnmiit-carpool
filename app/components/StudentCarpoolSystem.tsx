import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Linking,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Avatar, Chip, Searchbar } from "react-native-paper";
import {
  MapPin,
  Clock,
  Users,
  DollarSign,
  Filter,
  Star,
  Phone,
  MessageCircle,
  Calendar,
  Navigation,
  User,
  Car,
  ArrowRight,
  Plus,
  Menu,
  X,
  Check,
  Timer,
  AlertCircle,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "react-native";
// Removed Button import - using TouchableOpacity instead
import RideDetailsScreen from "./RideDetailsScreen";
import CreateRideScreen from "./CreateRideScreen";
import ChatScreen from "./ChatScreen";
import RequestAcceptanceModal from "./RequestAcceptanceModal";
import LoadingOverlay from "./LoadingOverlay";
import { socketService } from "../services/SocketService";
import { supabase } from "../lib/supabase";
import NotificationService from "../services/NotificationService";
import {
  parseEmailInfo,
  calculateAcademicYear,
  formatTime,
  formatDate,
  calculateRideExpiry,
  filterRides,
  generateAvatarFromName,
} from "../lib/utils";

interface CarpoolRide {
  id: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverPhoto: string;
  driverBranch: string;
  driverYear: string;
  driverPhone?: string;
  from: string;
  to: string;
  departureTime: string;
  date: string;
  availableSeats: number;
  totalSeats: number;
  pricePerSeat: number;
  vehicleInfo: {
    make: string;
    model: string;
    color: string;
    isAC: boolean;
  };
  route: string[];
  preferences: {
    gender?: "male" | "female" | "any";
    smokingAllowed: boolean;
    musicAllowed: boolean;
    petsAllowed: boolean;
  };
  status: "active" | "full" | "completed" | "cancelled";
  passengers: Array<{
    id: string;
    name: string;
    photo: string;
    joinedAt: string;
    status: "pending" | "accepted" | "confirmed";
    seatsBooked: number;
  }>;
  pendingRequests: Array<{
    id: string;
    passengerId: string;
    passengerName: string;
    passengerPhoto: string;
    seatsRequested: number;
    message?: string;
    requestedAt: string;
    status: "pending" | "accepted" | "rejected";
  }>;
  instantBooking: boolean;
  chatEnabled: boolean;
  createdAt: string;
}

interface StudentCarpoolSystemProps {
  isDarkMode?: boolean;
  currentUser?: {
    id: string;
    name: string;
    email: string;
    branch: string;
    year: string;
    rating: number;
    photo: string;
  };
  onCreateRide?: () => void;
  onJoinRide?: (rideId: string) => void;
  onShowBusBooking?: () => void;
  onToggleSidebar?: () => void;
}

const StudentCarpoolSystem = ({
  isDarkMode = false,
  currentUser = {
    id: "user_001",
    name: "Arjun Sharma",
    email: "21UCS045@lnmiit.ac.in",
    branch: "Computer Science",
    year: "3rd Year",
    rating: 4.7,
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=arjun",
  },
  onCreateRide = () => {},
  onJoinRide = () => {},
  onShowBusBooking = () => {},
  onToggleSidebar = () => {},
}: StudentCarpoolSystemProps) => {
  const [rides, setRides] = useState<CarpoolRide[]>([]);
  const [filteredRides, setFilteredRides] = useState<CarpoolRide[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "today" | "tomorrow" | "this_week"
  >("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [showRideDetails, setShowRideDetails] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userRideHistory, setUserRideHistory] = useState<any[]>([]);
  const [showCreateRide, setShowCreateRide] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatRideId, setChatRideId] = useState<string>("");
  const [chatRideTitle, setChatRideTitle] = useState<string>("");
  const [showJoinVerification, setShowJoinVerification] = useState(false);
  const [selectedRideForJoin, setSelectedRideForJoin] =
    useState<CarpoolRide | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false);
  const [showRequestAcceptance, setShowRequestAcceptance] = useState(false);
  const [selectedJoinRequest, setSelectedJoinRequest] = useState<any>(null);

  // Fetch rides from database
  const fetchRides = async () => {
    try {
      setLoading(true);

      // Auto-expire rides first
      await supabase.rpc("auto_expire_rides");

      const { data: ridesData, error } = await supabase
        .from("carpool_rides")
        .select("*")
        .in("status", ["active", "expired"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching rides:", error);
        return;
      }

      // Transform database data to frontend format
      const transformedRides: CarpoolRide[] = ridesData.map((ride) => {
        const emailInfo = parseEmailInfo(ride.driver_email);
        const academicYear = calculateAcademicYear(emailInfo.joiningYear);

        return {
          id: ride.id,
          driverId: ride.driver_id,
          driverName: ride.driver_name,
          driverRating: 4.8, // Default rating
          driverPhoto: generateAvatarFromName(ride.driver_name),
          driverBranch: emailInfo.branchFull,
          driverYear: academicYear,
          driverPhone: ride.driver_phone,
          from: ride.from_location,
          to: ride.to_location,
          departureTime: ride.departure_time, // Keep as ISO string for proper formatting
          date: ride.departure_date,
          availableSeats: ride.available_seats,
          totalSeats: ride.total_seats,
          pricePerSeat: ride.price_per_seat,
          vehicleInfo: {
            make: ride.vehicle_make || "Unknown",
            model: ride.vehicle_model || "Unknown",
            color: ride.vehicle_color || "White",
            isAC: ride.is_ac,
          },
          route: [ride.from_location, ride.to_location],
          preferences: {
            gender: "any" as const,
            smokingAllowed: ride.smoking_allowed,
            musicAllowed: ride.music_allowed,
            petsAllowed: ride.pets_allowed,
          },
          status: ride.status as "active" | "full" | "completed" | "cancelled",
          passengers: [], // TODO: Fetch from passengers table
          pendingRequests: [], // Will fetch separately if needed
          instantBooking: ride.instant_booking,
          chatEnabled: ride.chat_enabled,
          createdAt: ride.created_at,
        };
      });

      setRides(transformedRides);
      // Apply current filters to new data
      const filtered = filterRides(
        transformedRides,
        selectedFilter,
        searchQuery
      );
      setFilteredRides(filtered);
    } catch (error) {
      console.error("Error in fetchRides:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications from database
  const fetchNotifications = async () => {
    try {
      const { data: notificationsData, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        // If notifications table doesn't exist, just set empty array
        if (error.code === "42P01") {
          console.warn(
            "Notifications table not found. Please run setup-database.sql"
          );
          setNotifications([]);
          return;
        }
        console.error("Error fetching notifications:", error);
        return;
      }

      setNotifications(notificationsData || []);
    } catch (error) {
      console.error("Error in fetchNotifications:", error);
      setNotifications([]);
    }
  };

  // Fetch user's ride history
  const fetchUserRideHistory = async () => {
    try {
      // Fetch rides where user is driver
      const { data: driverRides, error: driverError } = await supabase
        .from("carpool_rides")
        .select("*")
        .eq("driver_id", currentUser.id)
        .order("created_at", { ascending: false });

      // Fetch rides where user is passenger
      const { data: passengerRides, error: passengerError } = await supabase
        .from("ride_passengers")
        .select(
          `
          *,
          carpool_rides (*)
        `
        )
        .eq("passenger_id", currentUser.id);

      let allRides: any[] = [];

      if (!driverError && driverRides) {
        allRides = [
          ...allRides,
          ...driverRides.map((ride) => ({ ...ride, userRole: "driver" })),
        ];
      }

      if (!passengerError && passengerRides) {
        allRides = [
          ...allRides,
          ...passengerRides.map((p) => ({
            ...p.carpool_rides,
            userRole: "passenger",
            joinedAt: p.joined_at,
          })),
        ];
      }

      // Sort by date
      allRides.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setUserRideHistory(allRides);
    } catch (error) {
      console.error("Error fetching ride history:", error);
      setUserRideHistory([]);
    }
  };

  useEffect(() => {
    fetchRides();
    fetchNotifications();
    fetchUserRideHistory();
    socketService.connect(currentUser.id);

    return () => {
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    const filtered = filterRides(rides, selectedFilter, searchQuery);
    setFilteredRides(filtered);
  }, [searchQuery, selectedFilter, rides]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRides(),
      fetchNotifications(),
      fetchUserRideHistory(),
    ]);
    setRefreshing(false);
  };

  // Function to flush all data - can be called from profile
  const flushAllData = async () => {
    setRides([]);
    setFilteredRides([]);
    setNotifications([]);
    setUserRideHistory([]);
    await handleRefresh();
  };

  // Handle notification clicks
  const handleNotificationClick = async (notification: any) => {
    try {
      if (notification.type === "join_request") {
        // For join request notifications, show the request acceptance modal
        const requestId = notification.data?.requestId;
        if (requestId) {
          // Fetch the full request details
          const { data: requestData, error } = await supabase
            .from("join_requests")
            .select(
              `
              *,
              carpool_rides(from_location, to_location, departure_time)
            `
            )
            .eq("id", requestId)
            .single();

          if (error || !requestData) {
            Alert.alert("Error", "Could not fetch request details");
            return;
          }

          // Transform data for the modal
          const transformedRequest = {
            id: requestData.id,
            passengerId: requestData.passenger_id,
            passengerName: requestData.passenger_name,
            passengerEmail: requestData.passenger_email,
            rideId: requestData.ride_id,
            from: requestData.carpool_rides.from_location,
            to: requestData.carpool_rides.to_location,
            departureTime: requestData.carpool_rides.departure_time,
            requestMessage: requestData.message,
            createdAt: requestData.created_at,
          };

          setSelectedJoinRequest(transformedRequest);
          setShowRequestAcceptance(true);

          // Mark notification as read
          await NotificationService.markAsRead(notification.id);
          fetchNotifications(); // Refresh notifications
        }
      }
    } catch (error) {
      console.error("Error handling notification:", error);
    }
  };

  // Handle request acceptance/rejection from modal
  const handleRequestHandled = (
    requestId: string,
    action: "accepted" | "rejected"
  ) => {
    setShowRequestAcceptance(false);
    setSelectedJoinRequest(null);
    // Refresh data
    handleRefresh();
  };

  const handleFilterSelect = async (filterKey: string, filterLabel: string) => {
    setSectionLoading(true);

    // Simulate loading for smooth UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    setSelectedFilter(filterKey as any);
    console.log(`Filter applied: ${filterLabel}`);

    setSectionLoading(false);
  };

  const handleJoinRide = (rideId: string) => {
    const ride = rides.find((r) => r.id === rideId);
    if (ride) {
      setSelectedRideForJoin(ride);
      setSeatsToBook(1);
      setJoinMessage("");
      if (ride.instantBooking) {
        setShowJoinVerification(true);
      } else {
        setShowJoinRequestModal(true);
      }
    }
  };

  const confirmJoinRide = async () => {
    if (!selectedRideForJoin) return;

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Error", "You must be logged in to join a ride");
        return;
      }

      // Check if user has already joined this ride
      const { data: existingPassenger } = await supabase
        .from("ride_passengers")
        .select("id")
        .eq("ride_id", selectedRideForJoin.id)
        .eq("passenger_id", user.id)
        .single();

      if (existingPassenger) {
        Alert.alert("Info", "You have already joined this ride!");
        return;
      }

      // Check if user has already sent a request for this ride
      const { data: existingRequest } = await supabase
        .from("join_requests")
        .select("id, status")
        .eq("ride_id", selectedRideForJoin.id)
        .eq("passenger_id", user.id)
        .single();

      if (existingRequest) {
        if (existingRequest.status === "pending") {
          Alert.alert("Info", "You have already sent a request for this ride!");
        } else if (existingRequest.status === "accepted") {
          Alert.alert(
            "Info",
            "Your request for this ride has already been accepted!"
          );
        } else if (existingRequest.status === "rejected") {
          Alert.alert(
            "Info",
            "Your request for this ride was previously rejected. Please try a different ride."
          );
        }
        return;
      }

      if (selectedRideForJoin.instantBooking) {
        // For instant booking, directly add to passengers
        const { error: passengerError } = await supabase
          .from("ride_passengers")
          .insert([
            {
              ride_id: selectedRideForJoin.id,
              passenger_id: user.id,
              passenger_name:
                user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "Passenger",
              passenger_email: user.email,
              seats_booked: seatsToBook,
              status: "confirmed",
              joined_at: new Date().toISOString(),
            },
          ]);

        if (passengerError) {
          console.error("Error adding passenger:", passengerError);
          Alert.alert("Error", "Failed to join ride. Please try again.");
          return;
        }

        // Update available seats
        const { error: updateError } = await supabase
          .from("carpool_rides")
          .update({
            available_seats: selectedRideForJoin.availableSeats - seatsToBook,
          })
          .eq("id", selectedRideForJoin.id);

        if (updateError) {
          console.error("Error updating seats:", updateError);
        }

        Alert.alert("Success", "You have successfully joined the ride!");
      } else {
        // For request-based booking, create a join request
        const { data: requestData, error: requestError } = await supabase
          .from("join_requests")
          .insert([
            {
              ride_id: selectedRideForJoin.id,
              passenger_id: user.id,
              passenger_name:
                user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "Passenger",
              passenger_email: user.email,
              seats_requested: seatsToBook,
              message: joinMessage,
              status: "pending",
              created_at: new Date().toISOString(),
            },
          ])
          .select();

        if (requestError || !requestData || requestData.length === 0) {
          console.error("Error creating join request:", requestError);
          Alert.alert(
            "Error",
            "Failed to send join request. Please try again."
          );
          return;
        }

        // Send notification to driver about the join request
        await NotificationService.notifyJoinRequest(
          selectedRideForJoin.driverId,
          user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Passenger",
          selectedRideForJoin.id,
          requestData[0].id,
          selectedRideForJoin.from,
          selectedRideForJoin.to
        );

        Alert.alert(
          "Request Sent",
          "Your join request has been sent to the driver. You'll be notified when they respond."
        );
      }

      // Refresh all data
      await handleRefresh();

      setShowJoinRequestModal(false);
      setSelectedRideForJoin(null);
      setJoinMessage("");
      setSeatsToBook(1);
    } catch (error) {
      console.error("Error in confirmJoinRide:", error);
      Alert.alert("Error", "Failed to process your request. Please try again.");
    }
  };

  const handleContactDriver = (ride: CarpoolRide) => {
    Alert.alert(
      "Contact Driver",
      `How would you like to contact ${ride.driverName}?`,
      [
        {
          text: "Call",
          onPress: () => {
            const phoneNumber = "tel:+919876543210"; // Mock phone number
            Linking.openURL(phoneNumber).catch(() => {
              Alert.alert("Error", "Unable to make phone call");
            });
          },
        },
        {
          text: "Chat",
          onPress: () => handleStartChat(ride.id, `${ride.from} → ${ride.to}`),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleStartChat = (rideId: string, rideTitle: string) => {
    setChatRideId(rideId);
    setChatRideTitle(rideTitle);
    setShowChat(true);
    setShowRideDetails(false);
  };

  const handleCreateRide = () => {
    setShowCreateRide(true);
  };

  const handleRideCreated = (rideData: any) => {
    setRides((prev) => [rideData, ...prev]);
    setShowCreateRide(false);
    handleRefresh(); // Refresh all data including ride history
  };

  const handleRideCardPress = (ride: CarpoolRide) => {
    setSelectedRideId(ride.id);
    setShowRideDetails(true);
  };

  const handleBackFromDetails = () => {
    setShowRideDetails(false);
    setSelectedRideId(null);
  };

  const renderJobStyleCard = (ride: CarpoolRide) => {
    const isDriverCurrentUser = ride.driverId === currentUser.id;
    const currentPassenger = ride.passengers.find(
      (p) => p.id === currentUser.id
    );
    const hasJoined = !!currentPassenger;
    const isPending = currentPassenger?.status === "pending";

    // Calculate expiry information
    const expiryInfo = calculateRideExpiry(ride.departureTime);

    const cardColors = [
      { bg: "#E8F5E8", accent: "#4CAF50" }, // Green
      { bg: "#FFF3E0", accent: "#FF9800" }, // Orange
      { bg: "#E3F2FD", accent: "#2196F3" }, // Blue
      { bg: "#F3E5F5", accent: "#9C27B0" }, // Purple
      { bg: "#FCE4EC", accent: "#E91E63" }, // Pink
    ];
    const colorIndex = ride.id
      ? (parseInt(ride.id.slice(-1)) || 0) % cardColors.length
      : 0;
    const colors = cardColors[colorIndex] || cardColors[0];

    return (
      <TouchableOpacity
        key={ride.id}
        style={[styles.jobCard, { backgroundColor: colors.bg }]}
        onPress={() => handleRideCardPress(ride)}
      >
        {/* Header with toggle and company name */}
        <View style={styles.jobHeader}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>LNMIIT Carpool</Text>
            <Text style={[styles.jobTitle, { color: colors.accent }]}>
              {ride.from} → {ride.to}
            </Text>
          </View>
          <View style={styles.toggleContainer}>
            <View style={[styles.toggle, { backgroundColor: colors.accent }]}>
              <View style={styles.toggleButton} />
            </View>
          </View>
        </View>

        {/* Job tags/skills */}
        <View style={styles.tagsContainer}>
          <View style={[styles.tag, { backgroundColor: colors.accent + "20" }]}>
            <Text style={[styles.tagText, { color: colors.accent }]}>
              ₹{ride.pricePerSeat}
            </Text>
          </View>
          <View style={[styles.tag, { backgroundColor: colors.accent + "20" }]}>
            <Text style={[styles.tagText, { color: colors.accent }]}>
              {formatTime(ride.departureTime)}
            </Text>
          </View>
          {ride.instantBooking && (
            <View style={[styles.tag, { backgroundColor: "#4CAF50" + "20" }]}>
              <Text style={[styles.tagText, { color: "#4CAF50" }]}>
                ⚡ Instant
              </Text>
            </View>
          )}
          {ride.pendingRequests.length > 0 &&
            ride.driverId === currentUser.id && (
              <View style={[styles.tag, { backgroundColor: "#FF9800" + "20" }]}>
                <Text style={[styles.tagText, { color: "#FF9800" }]}>
                  📩 {ride.pendingRequests.length} Request
                  {ride.pendingRequests.length > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          {ride.chatEnabled && (
            <View style={[styles.tag, { backgroundColor: "#2196F3" + "20" }]}>
              <Text style={[styles.tagText, { color: "#2196F3" }]}>
                💬 Chat
              </Text>
            </View>
          )}
        </View>

        {/* Expiry and availability section */}
        <View style={styles.applicantsSection}>
          <Clock size={16} color="#666" />
          <Text style={styles.applicantsText}>
            {ride.availableSeats > 0
              ? `${ride.availableSeats} seats available`
              : "Ride is full"}
          </Text>
        </View>

        {/* Expiry information */}
        <View style={styles.expirySection}>
          {expiryInfo.isExpired ? (
            <View style={styles.expiredTag}>
              <AlertCircle size={14} color="#F44336" />
              <Text style={styles.expiredText}>Expired</Text>
            </View>
          ) : (
            <View style={styles.expiryTag}>
              <Timer size={14} color="#FF9800" />
              <Text style={styles.expiryText}>
                Expires in {expiryInfo.timeUntilExpiry}
              </Text>
            </View>
          )}
          <Text style={styles.startTimeText}>
            Starts in {expiryInfo.timeUntilStart}
          </Text>
        </View>

        {/* Driver avatars and time */}
        <View style={styles.bottomSection}>
          <View style={styles.avatarsContainer}>
            <Avatar.Image
              size={32}
              source={{ uri: ride.driverPhoto }}
              style={styles.driverAvatar}
            />
            {ride.passengers.slice(0, 2).map((passenger, index) => (
              <Avatar.Image
                key={passenger.id}
                size={32}
                source={{ uri: passenger.photo }}
                style={[styles.passengerAvatar, { marginLeft: -8 }]}
              />
            ))}
            {ride.passengers.length > 2 && (
              <View style={styles.morePassengers}>
                <Text style={styles.morePassengersText}>
                  +{ride.passengers.length - 2}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.timeAgo}>
            {new Date(ride.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.jobActionButtons}>
          {!isDriverCurrentUser && !hasJoined && ride.availableSeats > 0 && (
            <>
              <TouchableOpacity
                style={[styles.contactBtn, { borderColor: colors.accent }]}
                onPress={() => handleContactDriver(ride)}
              >
                <Phone size={16} color={colors.accent} />
                <Text style={[styles.contactBtnText, { color: colors.accent }]}>
                  Contact
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.joinBtn, { backgroundColor: colors.accent }]}
                onPress={() => handleJoinRide(ride.id)}
              >
                <Text style={styles.joinBtnText}>
                  {ride.instantBooking ? "Book Now" : "Request Join"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {(hasJoined || isDriverCurrentUser) && ride.chatEnabled && (
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: "#2196F3" }]}
              onPress={() =>
                handleStartChat(ride.id, `${ride.from} → ${ride.to}`)
              }
            >
              <MessageCircle size={16} color="#2196F3" />
              <Text style={[styles.contactBtnText, { color: "#2196F3" }]}>
                Chat
              </Text>
            </TouchableOpacity>
          )}

          {hasJoined && !isPending && (
            <View
              style={[
                styles.joinedBtn,
                { backgroundColor: colors.accent + "20" },
              ]}
            >
              <Text style={[styles.joinedBtnText, { color: colors.accent }]}>
                ✓ Joined
              </Text>
            </View>
          )}

          {isPending && (
            <View
              style={[styles.joinedBtn, { backgroundColor: "#FFA726" + "20" }]}
            >
              <Text style={[styles.joinedBtnText, { color: "#FFA726" }]}>
                ⏳ Pending Approval
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const sidebarCategories = [
    {
      key: "notifications",
      label: "Notifications",
      count: `${unreadNotifications}`,
      color: "#FF5722",
      icon: "🔔",
    },
    {
      key: "search",
      label: "Search Rides",
      count: `${filteredRides.length}`,
      color: "#4CAF50",
      icon: "🔍",
    },
    {
      key: "create",
      label: "Create Ride",
      count: "New",
      color: "#2196F3",
      icon: "➕",
    },
    {
      key: "history",
      label: "My History",
      count: `${userRideHistory.length}`,
      color: "#9C27B0",
      icon: "📋",
    },
  ];

  return (
    <>
      {/* Main Container */}
      <View
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? "#000" : "#F8F9FA" },
        ]}
      >
        {/* Search Bar with Menu */}
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={onToggleSidebar} style={styles.menuBtn}>
            <Menu size={24} color={isDarkMode ? "#FFF" : "#000"} />
          </TouchableOpacity>
          <Searchbar
            placeholder="Search by destination..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[
              styles.searchBar,
              { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
            ]}
            inputStyle={{ color: isDarkMode ? "#FFF" : "#000" }}
            iconColor={isDarkMode ? "#CCC" : "#666"}
          />
          <TouchableOpacity style={styles.filterIcon}>
            <Filter size={20} color={isDarkMode ? "#CCC" : "#666"} />
          </TouchableOpacity>
        </View>

        {/* Quick Tips */}
        {!searchQuery && filteredRides.length === 0 && (
          <View style={styles.quickTips}>
            <Text
              style={[
                styles.tipsTitle,
                { color: isDarkMode ? "#FFF" : "#000" },
              ]}
            >
              💡 Quick Tips for Finding Rides:
            </Text>
            <Text
              style={[styles.tipsText, { color: isDarkMode ? "#CCC" : "#666" }]}
            >
              • Most rides are posted 1-2 hours before departure{"\n"}• Check
              "Tomorrow" and "This Week" filters{"\n"}• Try searching popular
              destinations like "Railway Station", "Airport", or "Mall"
            </Text>
          </View>
        )}

        {/* Available Rides Section */}
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDarkMode ? "#FFF" : "#000" },
            ]}
          >
            Available Rides
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: isDarkMode ? "#CCC" : "#666" },
            ]}
          >
            {filteredRides.length} rides found
          </Text>
        </View>

        {/* Rides List */}
        <ScrollView
          style={styles.ridesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#000000"]}
              tintColor={isDarkMode ? "#FFF" : "#000"}
            />
          }
        >
          {filteredRides.length > 0 ? (
            filteredRides.map(renderJobStyleCard)
          ) : (
            <View style={styles.emptyState}>
              <Car size={64} color={isDarkMode ? "#666" : "#CCC"} />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: isDarkMode ? "#FFF" : "#000" },
                ]}
              >
                No rides available right now
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: isDarkMode ? "#CCC" : "#666" },
                ]}
              >
                • Try searching for different locations{"\n"}• Check rides for
                tomorrow or this week{"\n"}• Create your own ride and invite
                others
              </Text>
              <TouchableOpacity
                style={[
                  styles.createRideButton,
                  { backgroundColor: isDarkMode ? "#FFF" : "#000" },
                ]}
                onPress={handleCreateRide}
              >
                <Plus size={20} color={isDarkMode ? "#000" : "#FFF"} />
                <Text
                  style={[
                    styles.createRideText,
                    { color: isDarkMode ? "#000" : "#FFF" },
                  ]}
                >
                  Create a Ride
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Actions Section */}
          <Text
            style={[
              styles.sectionTitle,
              {
                color: isDarkMode ? "#FFF" : "#000",
                marginTop: 32,
                marginHorizontal: 20,
                marginBottom: 16,
              },
            ]}
          >
            Quick Actions
          </Text>

          <View style={styles.categoriesGrid}>
            {sidebarCategories.map((category, index) => (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryCard,
                  { backgroundColor: category.color },
                ]}
              >
                <Text style={styles.categoryCardEmoji}>{category.icon}</Text>
                <Text style={styles.categoryCardTitle}>{category.label}</Text>
                <Text style={styles.categoryCardCount}>
                  {category.key === "create"
                    ? category.count
                    : `${category.count} available`}
                </Text>
                <TouchableOpacity
                  style={styles.viewJobsBtn}
                  onPress={() => {
                    if (category.key === "create") {
                      handleCreateRide();
                    } else if (category.key === "notifications") {
                      // Show a list of notifications and handle clicks
                      if (notifications.length > 0) {
                        Alert.alert(
                          "Notifications",
                          `You have ${unreadNotifications} unread notifications`,
                          [
                            {
                              text: "View Latest",
                              onPress: () => {
                                const latestNotification = notifications.find(
                                  (n) => !n.read
                                );
                                if (latestNotification) {
                                  handleNotificationClick(latestNotification);
                                }
                              },
                            },
                            {
                              text: "Mark All Read",
                              onPress: async () => {
                                await NotificationService.markAllAsRead(
                                  currentUser.id
                                );
                                fetchNotifications();
                              },
                            },
                            { text: "Cancel", style: "cancel" },
                          ]
                        );
                      } else {
                        Alert.alert("Notifications", "No notifications yet!");
                      }
                    }
                  }}
                >
                  <Text style={styles.viewJobsBtnText}>
                    {category.key === "create" ? "Start Now" : "View All"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Floating Create Ride Button */}
        <TouchableOpacity
          style={[
            styles.floatingButton,
            { backgroundColor: isDarkMode ? "#FFF" : "#000" },
          ]}
          onPress={handleCreateRide}
        >
          <Plus size={24} color={isDarkMode ? "#000" : "#FFF"} />
        </TouchableOpacity>
      </View>

      {/* Modals */}
      {showRideDetails && selectedRideId && (
        <RideDetailsScreen
          rideId={selectedRideId}
          currentUser={currentUser}
          visible={showRideDetails}
          onBack={handleBackFromDetails}
          onJoinRide={handleJoinRide}
          onStartChat={handleStartChat}
        />
      )}

      {showCreateRide && (
        <CreateRideScreen
          onBack={() => setShowCreateRide(false)}
          onRideCreated={handleRideCreated}
          isDarkMode={isDarkMode}
        />
      )}

      {showChat && (
        <ChatScreen
          rideId={chatRideId}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          rideTitle={chatRideTitle}
          onBack={() => setShowChat(false)}
          isDarkMode={isDarkMode}
          rideDetails={{
            from: "LNMIIT Campus",
            to: "Jaipur Railway Station",
            departureTime: "2:30 PM",
            date: "Today",
            driverName: "Ride Creator",
            driverPhone: "+91 98765 43210",
            driverRating: 4.8,
            driverPhoto:
              "https://api.dicebear.com/7.x/avataaars/svg?seed=driver",
            pricePerSeat: 120,
            availableSeats: 2,
          }}
        />
      )}

      {/* Join Verification Modal */}
      {showJoinVerification && selectedRideForJoin && (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.verificationModal,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF" },
              ]}
            >
              <View style={styles.verificationHeader}>
                <View
                  style={[
                    styles.verificationIcon,
                    { backgroundColor: isDarkMode ? "#4CAF50" : "#E8F5E8" },
                  ]}
                >
                  <Check size={32} color={isDarkMode ? "#FFFFFF" : "#4CAF50"} />
                </View>
                <Text
                  style={[
                    styles.verificationTitle,
                    { color: isDarkMode ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  Join Ride Confirmation
                </Text>
                <Text
                  style={[
                    styles.verificationSubtitle,
                    { color: isDarkMode ? "#CCCCCC" : "#666666" },
                  ]}
                >
                  Please verify your details before joining
                </Text>
              </View>

              <ScrollView
                style={styles.verificationContent}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Ride Details */}
                <View
                  style={[
                    styles.verificationSection,
                    { backgroundColor: isDarkMode ? "#2A2A2A" : "#F8F9FA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationSectionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    🚗 Ride Details
                  </Text>
                  <View style={styles.verificationRow}>
                    <MapPin
                      size={16}
                      color={isDarkMode ? "#CCCCCC" : "#666666"}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDarkMode ? "#CCCCCC" : "#666666" },
                      ]}
                    >
                      {selectedRideForJoin.from} → {selectedRideForJoin.to}
                    </Text>
                  </View>
                  <View style={styles.verificationRow}>
                    <Clock
                      size={16}
                      color={isDarkMode ? "#CCCCCC" : "#666666"}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDarkMode ? "#CCCCCC" : "#666666" },
                      ]}
                    >
                      {selectedRideForJoin.date} at{" "}
                      {selectedRideForJoin.departureTime}
                    </Text>
                  </View>
                  <View style={styles.verificationRow}>
                    <DollarSign
                      size={16}
                      color={isDarkMode ? "#CCCCCC" : "#666666"}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDarkMode ? "#CCCCCC" : "#666666" },
                      ]}
                    >
                      ₹{selectedRideForJoin.pricePerSeat} per seat
                    </Text>
                  </View>
                </View>

                {/* Driver Info */}
                <View
                  style={[
                    styles.verificationSection,
                    { backgroundColor: isDarkMode ? "#2A2A2A" : "#F8F9FA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationSectionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    👤 Ride Creator Details
                  </Text>
                  <View style={styles.driverVerificationInfo}>
                    <Image
                      source={{ uri: selectedRideForJoin.driverPhoto }}
                      style={styles.driverVerificationAvatar}
                    />
                    <View style={styles.driverVerificationDetails}>
                      <Text
                        style={[
                          styles.driverVerificationName,
                          { color: isDarkMode ? "#FFFFFF" : "#000000" },
                        ]}
                      >
                        {selectedRideForJoin.driverName}
                      </Text>
                      <View style={styles.driverVerificationRating}>
                        <Star size={14} color="#FFD700" fill="#FFD700" />
                        <Text
                          style={[
                            styles.driverVerificationRatingText,
                            { color: isDarkMode ? "#CCCCCC" : "#666666" },
                          ]}
                        >
                          {selectedRideForJoin.driverRating} •{" "}
                          {selectedRideForJoin.driverBranch}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* User Verification */}
                <View
                  style={[
                    styles.verificationSection,
                    { backgroundColor: isDarkMode ? "#2A2A2A" : "#F8F9FA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationSectionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    ✅ Your Details
                  </Text>
                  <View style={styles.userVerificationInfo}>
                    <Image
                      source={{ uri: currentUser.photo }}
                      style={styles.userVerificationAvatar}
                    />
                    <View style={styles.userVerificationDetails}>
                      <Text
                        style={[
                          styles.userVerificationName,
                          { color: isDarkMode ? "#FFFFFF" : "#000000" },
                        ]}
                      >
                        {currentUser.name}
                      </Text>
                      <Text
                        style={[
                          styles.userVerificationBranch,
                          { color: isDarkMode ? "#CCCCCC" : "#666666" },
                        ]}
                      >
                        {currentUser.branch} • {currentUser.year}
                      </Text>
                      <Text
                        style={[
                          styles.userVerificationEmail,
                          { color: isDarkMode ? "#999999" : "#888888" },
                        ]}
                      >
                        {currentUser.email}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.verificationActions}>
                <TouchableOpacity
                  style={[
                    styles.cancelVerificationButton,
                    { borderColor: isDarkMode ? "#666666" : "#CCCCCC" },
                  ]}
                  onPress={() => {
                    setShowJoinVerification(false);
                    setSelectedRideForJoin(null);
                  }}
                >
                  <X size={16} color={isDarkMode ? "#666666" : "#CCCCCC"} />
                  <Text
                    style={[
                      styles.cancelVerificationText,
                      { color: isDarkMode ? "#666666" : "#CCCCCC" },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmVerificationButton,
                    { backgroundColor: isDarkMode ? "#4CAF50" : "#2E7D32" },
                  ]}
                  onPress={confirmJoinRide}
                >
                  <Check size={16} color="#FFFFFF" />
                  <Text
                    style={[
                      styles.confirmVerificationText,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    Confirm & Join Ride
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Join Request Modal */}
      {showJoinRequestModal && selectedRideForJoin && (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.verificationModal,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF" },
              ]}
            >
              <View style={styles.verificationHeader}>
                <View
                  style={[
                    styles.verificationIcon,
                    { backgroundColor: isDarkMode ? "#2196F3" : "#E3F2FD" },
                  ]}
                >
                  <MessageCircle
                    size={32}
                    color={isDarkMode ? "#FFFFFF" : "#2196F3"}
                  />
                </View>
                <Text
                  style={[
                    styles.verificationTitle,
                    { color: isDarkMode ? "#FFFFFF" : "#000000" },
                  ]}
                >
                  Request to Join Ride
                </Text>
                <Text
                  style={[
                    styles.verificationSubtitle,
                    { color: isDarkMode ? "#CCCCCC" : "#666666" },
                  ]}
                >
                  Send a request to the driver
                </Text>
              </View>

              <ScrollView
                style={styles.verificationContent}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Ride Details */}
                <View
                  style={[
                    styles.verificationSection,
                    { backgroundColor: isDarkMode ? "#2A2A2A" : "#F8F9FA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationSectionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    🚗 Ride Details
                  </Text>
                  <View style={styles.verificationRow}>
                    <MapPin
                      size={16}
                      color={isDarkMode ? "#CCCCCC" : "#666666"}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDarkMode ? "#CCCCCC" : "#666666" },
                      ]}
                    >
                      {selectedRideForJoin.from} → {selectedRideForJoin.to}
                    </Text>
                  </View>
                  <View style={styles.verificationRow}>
                    <Clock
                      size={16}
                      color={isDarkMode ? "#CCCCCC" : "#666666"}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDarkMode ? "#CCCCCC" : "#666666" },
                      ]}
                    >
                      {selectedRideForJoin.date} at{" "}
                      {selectedRideForJoin.departureTime}
                    </Text>
                  </View>
                  <View style={styles.verificationRow}>
                    <DollarSign
                      size={16}
                      color={isDarkMode ? "#CCCCCC" : "#666666"}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: isDarkMode ? "#CCCCCC" : "#666666" },
                      ]}
                    >
                      ₹{selectedRideForJoin.pricePerSeat} per seat
                    </Text>
                  </View>
                </View>

                {/* Seat Selection */}
                <View
                  style={[
                    styles.verificationSection,
                    { backgroundColor: isDarkMode ? "#2A2A2A" : "#F8F9FA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationSectionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    🎫 Seats Required
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setSeatsToBook(Math.max(1, seatsToBook - 1))
                      }
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isDarkMode ? "#333" : "#E0E0E0",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: isDarkMode ? "#FFF" : "#000",
                          fontSize: 18,
                        }}
                      >
                        -
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        color: isDarkMode ? "#FFFFFF" : "#000000",
                        minWidth: 30,
                        textAlign: "center",
                      }}
                    >
                      {seatsToBook}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setSeatsToBook(
                          Math.min(
                            selectedRideForJoin.availableSeats,
                            seatsToBook + 1
                          )
                        )
                      }
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isDarkMode ? "#333" : "#E0E0E0",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: isDarkMode ? "#FFF" : "#000",
                          fontSize: 18,
                        }}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.verificationText,
                        {
                          color: isDarkMode ? "#CCCCCC" : "#666666",
                          marginLeft: 8,
                        },
                      ]}
                    >
                      (Max: {selectedRideForJoin.availableSeats})
                    </Text>
                  </View>
                </View>

                {/* Message */}
                <View
                  style={[
                    styles.verificationSection,
                    { backgroundColor: isDarkMode ? "#2A2A2A" : "#F8F9FA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.verificationSectionTitle,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    💬 Message to Driver (Optional)
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: isDarkMode ? "#444" : "#E0E0E0",
                      borderRadius: 8,
                      padding: 12,
                      minHeight: 80,
                      textAlignVertical: "top",
                      color: isDarkMode ? "#FFFFFF" : "#000000",
                      backgroundColor: isDarkMode ? "#333" : "#FFFFFF",
                    }}
                    multiline
                    placeholder="Introduce yourself or add any special requests..."
                    placeholderTextColor={isDarkMode ? "#888" : "#999"}
                    value={joinMessage}
                    onChangeText={setJoinMessage}
                  />
                </View>
              </ScrollView>

              <View style={styles.verificationActions}>
                <TouchableOpacity
                  style={[
                    styles.cancelVerificationButton,
                    { borderColor: isDarkMode ? "#666666" : "#CCCCCC" },
                  ]}
                  onPress={() => {
                    setShowJoinRequestModal(false);
                    setSelectedRideForJoin(null);
                    setJoinMessage("");
                    setSeatsToBook(1);
                  }}
                >
                  <X size={16} color={isDarkMode ? "#666666" : "#CCCCCC"} />
                  <Text
                    style={[
                      styles.cancelVerificationText,
                      { color: isDarkMode ? "#666666" : "#CCCCCC" },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmVerificationButton,
                    { backgroundColor: "#2196F3" },
                  ]}
                  onPress={confirmJoinRide}
                >
                  <MessageCircle size={16} color="#FFFFFF" />
                  <Text
                    style={[
                      styles.confirmVerificationText,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    Send Request
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Request Acceptance Modal */}
      <RequestAcceptanceModal
        visible={showRequestAcceptance}
        onClose={() => {
          setShowRequestAcceptance(false);
          setSelectedJoinRequest(null);
        }}
        request={selectedJoinRequest}
        onRequestHandled={handleRequestHandled}
        isDarkMode={isDarkMode}
      />

      {/* Loading Overlays */}
      <LoadingOverlay
        visible={loading}
        message="Loading rides..."
        isDarkMode={isDarkMode}
      />

      <LoadingOverlay
        visible={sectionLoading}
        message="Applying filter..."
        isDarkMode={isDarkMode}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0, // Full height coverage - covers bottom navbar too
    width: "75%", // 85% of screen width for better coverage
    maxWidth: 380, // Maximum width cap
    zIndex: 9999, // Very high z-index to ensure it covers everything
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20, // Much higher elevation for Android
  },
  sidebarGradient: {
    flex: 1,
  },
  sidebarHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modernHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLogoSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modernLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modernLogoText: {
    fontSize: 20,
  },
  headerTextSection: {
    flex: 1,
  },
  modernSidebarTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  modernSidebarSubtitle: {
    fontSize: 13,
    opacity: 0.8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 16,
  },
  sidebarSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  userInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    borderWidth: 3,
    borderColor: "#4CAF50",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  userBranch: {
    fontSize: 12,
    marginBottom: 4,
  },
  userRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modernCategoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
  },
  modernCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  modernCategoryEmoji: {
    fontSize: 18,
  },
  modernCategoryInfo: {
    flex: 1,
  },
  modernCategoryLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  modernCategoryCount: {
    fontSize: 12,
  },
  menuSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
  },
  menuItemIcon: {
    fontSize: 16,
    marginRight: 16,
    width: 20,
    textAlign: "center",
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  menuItemCount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  sidebarFooter: {
    padding: 20,
    borderTopWidth: 1,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  footerSubtext: {
    fontSize: 10,
  },
  sidebarHeader: {
    padding: 24,
    paddingTop: 60,
  },
  closeBtn: {
    marginRight: 16,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sidebarContent: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 9998,
  },
  overlayTouchable: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  // Removed header styles - no longer needed
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20, // ← ADJUST THIS VALUE to change top spacing from status bar
    marginBottom: 24,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    borderRadius: 12,
  },
  menuBtn: {
    padding: 8,
    borderRadius: 8,
  },
  filterIcon: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    opacity: 0.7,
  },
  quickTips: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ridesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  jobCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  toggleContainer: {
    alignItems: "center",
  },
  toggle: {
    width: 32,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 2,
  },
  toggleButton: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFF",
  },
  tagsContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  applicantsSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  applicantsText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  expirySection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingLeft: 4,
  },
  expiredTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiredText: {
    fontSize: 12,
    color: "#F44336",
    fontWeight: "600",
    marginLeft: 4,
  },
  expiryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiryText: {
    fontSize: 12,
    color: "#FF9800",
    fontWeight: "600",
    marginLeft: 4,
  },
  startTimeText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    borderWidth: 2,
    borderColor: "#FFF",
  },
  passengerAvatar: {
    borderWidth: 2,
    borderColor: "#FFF",
  },
  morePassengers: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  morePassengersText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  timeAgo: {
    fontSize: 14,
    color: "#666",
  },
  jobActionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  joinBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  joinBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  joinedBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  joinedBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  categoryCard: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  categoryCardEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  categoryCardTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  categoryCardCount: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  viewJobsBtn: {
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewJobsBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  createRideButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  createRideText: {
    fontSize: 16,
    fontWeight: "600",
  },
  floatingButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Verification Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  verificationModal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    height: "80%",
    maxHeight: 600,
  },
  verificationHeader: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  verificationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  verificationSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  verificationContent: {
    flex: 1,
    padding: 20,
  },
  verificationSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verificationSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingLeft: 4,
  },
  verificationText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  driverVerificationInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverVerificationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  driverVerificationDetails: {
    flex: 1,
  },
  driverVerificationName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  driverVerificationRating: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverVerificationRatingText: {
    fontSize: 14,
    marginLeft: 4,
  },
  userVerificationInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  userVerificationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userVerificationDetails: {
    flex: 1,
  },
  userVerificationName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  userVerificationBranch: {
    fontSize: 14,
    marginBottom: 2,
  },
  userVerificationEmail: {
    fontSize: 12,
  },
  importantNotice: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  verificationActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  cancelVerificationButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cancelVerificationText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmVerificationButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  confirmVerificationText: {
    fontSize: 14,
    fontWeight: "600",
  },
  colorfulMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemSubtext: {
    fontSize: 12,
    fontWeight: "600",
  },
  menuItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  safetySection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  safetyAlertButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  safetyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  safetyIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  safetyTextContainer: {
    flex: 1,
  },
  safetyMainText: {
    fontSize: 16,
    fontWeight: "600",
  },
  safetySubText: {
    fontSize: 12,
    fontWeight: "500",
  },
  safetyPulse: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF",
    marginLeft: 8,
  },
  safetyPulseInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    margin: 2,
  },
});

StudentCarpoolSystem.displayName = "StudentCarpoolSystem";

export default StudentCarpoolSystem;
